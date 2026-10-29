import SwiftUI
import SwiftData

/// Çocuk ana ekranı: Masal Adası haritası (§3.2).
/// Kaydırılır ve iki parmakla yakınlaştırılır; bölgeye dokununca kamera oraya uçar, rehber konuşur,
/// bölgenin masal kartları balon gibi süzülür. Üstte yalnızca 2 ikon: Hazine Sandığı (sol), Ebeveyn Köşesi (sağ).
struct WorldMapView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @Query private var families: [Family]

    @State private var model: WorldViewModel?
    @State private var sheet: MapSheet?
    @State private var pendingSheet: MapSheet?
    @GestureState private var dragTranslation: CGSize = .zero
    @GestureState private var pinchScale: CGFloat = 1

    private var family: Family? { families.first }
    private var child: ChildProfile? { family?.activeChild }
    private var isBedtimeNear: Bool { BedtimeNudge.isNear(.now, bedtime: appState.bedtime) }

    var body: some View {
        GeometryReader { geo in
            let viewport = geo.size
            ZStack {
                background
                if let model {
                    mapLayer(model: model, viewport: viewport)
                    overlays(model: model, viewport: viewport)
                }
            }
            .task {
                Perf.event("MapAppear")
                let isFirstLoad = model == nil
                let m = model ?? WorldViewModel(api: appState.api)
                model = m
                syncProgress(m)
                if voiceOverEnabled { m.fitWholeIsland(viewport: viewport) }
                else if isFirstLoad { m.resetCamera(viewport: viewport) }
                if appState.opensTonightOnNextMapAppear {
                    // Onboarding'den hemen sonra: doğrudan ilk masal (§3.1 adım 6).
                    appState.opensTonightOnNextMapAppear = false
                    sheet = .tonight
                }
                await m.load()
                if sheet == nil { m.greetIfNeeded(isBedtimeNear: isBedtimeNear) }
                AmbientSoundPlayer.shared.isEnabled = family?.settings?.ambientSoundEnabled ?? true
                AmbientSoundPlayer.shared.play(for: theme.mode)
            }
            .onChange(of: theme.mode) { _, mode in AmbientSoundPlayer.shared.play(for: mode) }
        }
        .ignoresSafeArea()
        .sheet(item: $sheet, onDismiss: presentPending) { destination(for: $0) }
        #if DEBUG
        .onLongPressGesture(minimumDuration: 3) { sheet = .gallery }
        #endif
    }

    // MARK: Katmanlar

    @ViewBuilder private var background: some View {
        // Deniz rengi: haritanın kenarı görünürse dikiş olmasın.
        (theme.mode == .night ? Color(hex: "#211D55") : Color(hex: "#8EDCF9")).ignoresSafeArea()
    }

    /// Kameranın o anki (parmak hareketi dahil) değeri.
    private func liveCamera(_ model: WorldViewModel, viewport: CGSize) -> MapCamera {
        model.camera.zoomed(by: pinchScale).panned(by: dragTranslation)
            .clamped(world: WorldLayout.size, viewport: viewport)
    }

    private func mapLayer(model: WorldViewModel, viewport: CGSize) -> some View {
        let cam = liveCamera(model, viewport: viewport)
        let origin = cam.origin(in: viewport)
        return world(model: model, viewport: viewport)
            .frame(width: WorldLayout.size.width, height: WorldLayout.size.height)
            .scaleEffect(cam.zoom, anchor: .topLeading)
            .offset(x: origin.x, y: origin.y)
            .frame(width: viewport.width, height: viewport.height, alignment: .topLeading)
            .clipped()
            .contentShape(Rectangle())
            .gesture(panGesture(model: model, viewport: viewport).simultaneously(with: zoomGesture(model: model, viewport: viewport)))
            .accessibilityElement(children: .contain)
            .accessibilityLabel(Text("Masal Adası"))
    }

    private func world(model: WorldViewModel, viewport: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            // Kaydırma/yakınlaştırma her karede gövdeyi yeniden hesaplar; zemin yalnızca mod değişince çizilir.
            IslandTerrain(mode: theme.mode).equatable()
            ForEach(Region.allCases.filter { $0 != .sleepHouse }) { region in
                regionMarker(region, model: model, viewport: viewport)
                    .position(WorldLayout.position(of: region))
            }
            SleepHouseView(avatar: child?.avatar ?? .default, companion: child?.companion ?? .pamuk,
                           companionOutfit: child.flatMap { $0.outfit(for: $0.companion) },
                           isBedtimeNear: isBedtimeNear) {
                // "Bu Gece" akışı (Adım 7): Pamuk karşılar, seçimler orada yapılır.
                sheet = .tonight
            }
            .position(WorldLayout.position(of: .sleepHouse))
        }
    }

    private func regionMarker(_ region: Region, model: WorldViewModel, viewport: CGSize) -> some View {
        let locked = !model.isUnlocked(region)
        return VStack(spacing: 4) {
            IslandRegionView(region: region, isLocked: locked, isHighlighted: model.selectedRegion == region,
                             size: WorldLayout.regionSize) {
                if region == .treasureChest && !locked {
                    sheet = .treasure
                } else {
                    model.tap(region, viewport: viewport, reduceMotion: reduceMotion, mode: theme.mode)
                }
            }
            .rotationEffect(.degrees(model.nudgedRegion == region && !reduceMotion ? 4 : 0))
            .animation(reduceMotion ? nil : .spring(response: 0.2, dampingFraction: 0.3), value: model.nudgedRegion)
            RegionLabel(region: region)
                .accessibilityHidden(true)
        }
    }

    @ViewBuilder private func overlays(model: WorldViewModel, viewport: CGSize) -> some View {
        VStack {
            topBar
            Spacer()
            if let region = model.selectedRegion, region != .sleepHouse {
                RegionStoriesOverlay(region: region, items: model.stories(for: region),
                                     isSleeping: model.isSleeping,
                                     onSelect: { sheet = .story($0) },
                                     onClose: { model.dismissRegion(viewport: viewport, reduceMotion: reduceMotion, mode: theme.mode) })
                    .id(region)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(.top, 54)
        .padding(.bottom, 20)
        .animation(Motion.standard(theme.mode, reduceMotion: reduceMotion), value: model.selectedRegion)
    }

    private var topBar: some View {
        HStack {
            BubbleButton(systemImage: "shippingbox.fill", color: .sun, accessibilityLabel: "Hazine Sandığı") {
                sheet = .treasure
            }
            // Yeni ödül varsa küçük bir parıltı (gece kutlama ekranı yok; çocuk sabah fark eder).
            .overlay(alignment: .topTrailing) {
                if (child?.newRewardCount ?? 0) > 0 {
                    Image(systemName: "sparkle").font(.system(size: 18, weight: .heavy))
                        .foregroundStyle(Palette.berry)
                        .padding(4).background(Circle().fill(.white))
                        .offset(x: 6, y: -6)
                        .accessibilityLabel(Text("Yeni ödül var"))
                }
            }
            Spacer()
            // Ebeveyn köşesi: küçük ve kilitli; çocuk için bir "oyun" düğmesi gibi görünmez.
            BubbleButton(systemImage: "lock.fill", color: .grape, accessibilityLabel: "Ebeveyn Köşesi") {
                sheet = .parentGate
            }
            .accessibilityIdentifier("map.parentZone")
        }
        .padding(.horizontal, Metrics.spacingM)
    }

    // MARK: Hareketler

    private func panGesture(model: WorldViewModel, viewport: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 8)
            .updating($dragTranslation) { value, state, _ in state = value.translation }
            .onEnded { value in model.commitPan(value.translation, viewport: viewport) }
    }

    private func zoomGesture(model: WorldViewModel, viewport: CGSize) -> some Gesture {
        MagnifyGesture()
            .updating($pinchScale) { value, state, _ in state = value.magnification }
            .onEnded { value in model.commitZoom(value.magnification, viewport: viewport) }
    }

    // MARK: Yönlendirme

    private func syncProgress(_ model: WorldViewModel) {
        model.listenedStories = child?.listenedStoryCount ?? 0
        model.hasValueTopics = !(child?.values.isEmpty ?? true)
        model.isPremium = family?.entitlement?.isPremium ?? false
        model.ownedPacks = Set(family?.entitlement?.ownedProductIDs ?? [])
    }

    private func presentPending() {
        if let next = pendingSheet {
            pendingSheet = nil
            sheet = next
        }
    }

    @ViewBuilder private func destination(for sheet: MapSheet) -> some View {
        switch sheet {
        case .tonight:
            TonightFlowView(onClose: { self.sheet = nil }, onOpenLibraryStory: { item in
                // Bu Gece'yi kapat, ardından kitaplık masalını aç.
                pendingSheet = .story(item)
                self.sheet = nil
            })
            .interactiveDismissDisabled()
        case .treasure: TreasureChestView { self.sheet = nil }.themed(theme.mode)
        case .story(let item):
            LibraryStoryPlayerContainer(item: item) { self.sheet = nil }
                .themed(.night)
                .interactiveDismissDisabled()
        case .parentZone: ParentZoneView { self.sheet = nil }.themed(.day)
        case .gallery: ComponentGalleryView()
        case .parentGate:
            ParentGate(onUnlock: {
                pendingSheet = .parentZone
                self.sheet = nil
            }, onCancel: { self.sheet = nil })
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Palette.cream.ignoresSafeArea())
            .themed(.day)
        }
    }
}

/// Haritadan açılan ekranlar. Adım 6–9'da yer tutucular gerçek ekranlarla değişecek.
enum MapSheet: Identifiable, Hashable {
    case tonight, treasure, parentGate, parentZone, gallery
    case story(LibraryItemDTO)

    var id: String {
        switch self {
        case .tonight: "tonight"
        case .treasure: "treasure"
        case .parentGate: "parentGate"
        case .parentZone: "parentZone"
        case .gallery: "gallery"
        case .story(let item): "story-\(item.id)"
        }
    }
}

#Preview("Masal Adası — Gündüz") {
    WorldMapView()
        .environment(AppState())
        .modelContainer(PersistenceController.preview.container)
        .themed(.day)
}

#Preview("Masal Adası — Gece") {
    WorldMapView()
        .environment(AppState())
        .modelContainer(PersistenceController.preview.container)
        .themed(.night)
}
