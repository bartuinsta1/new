import SwiftUI
import SwiftData

/// "Bu Gece" akışı (§3.3), Gece Modu'nda.
/// Uyku Evi → Pamuk karşılar → Kim olsun? → Nerede geçsin? → Ne olsun? (ya da "Pamuk seçsin")
/// → Pamuk kitabı açar, sayfalardan yıldızlar çıkar → ilk paragraf gelir gelmez oynatıcı.
struct TonightFlowView: View {
    var onClose: () -> Void = {}
    /// Günlük hak dolunca çocuğa kitaplıktan masal önerilir.
    var onOpenLibraryStory: (LibraryItemDTO) -> Void = { _ in }

    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var context
    @Query private var families: [Family]
    @State private var model: TonightModel?

    var body: some View {
        ZStack {
            if let model {
                TonightContent(model: model, onClose: close, onOpenLibraryStory: onOpenLibraryStory)
            } else {
                NightSkyBackground()
            }
        }
        .themed(.night)
        .task {
            guard model == nil else { return }
            let family = families.first
            model = TonightModel(api: appState.api, context: context,
                                 child: family?.activeChild,
                                 settings: family?.settings,
                                 isBedtimeNear: BedtimeNudge.isNear(.now, bedtime: appState.bedtime))
        }
    }

    private func close() {
        model?.cancel()
        onClose()
    }
}

private struct TonightContent: View {
    let model: TonightModel
    var onClose: () -> Void
    var onOpenLibraryStory: (LibraryItemDTO) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showsLibrary = false

    var body: some View {
        ZStack {
            switch model.step {
            case .playing:
                if let player = model.player {
                    StoryPlayerView(model: player, onClose: onClose)
                        .transition(.opacity)
                }
            default:
                NightSkyBackground(showsFireflies: !reduceMotion)
                VStack(spacing: Metrics.spacingL) {
                    header
                    Spacer(minLength: 0)
                    stepContent
                        .id(model.step)
                        .transition(.asymmetric(insertion: .scale(scale: 0.8).combined(with: .opacity),
                                                removal: .opacity))
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, Metrics.spacingM)
                .padding(.bottom, Metrics.spacingL)
            }
        }
        .animation(Motion.standard(.night, reduceMotion: reduceMotion), value: model.step)
        .fullScreenCover(isPresented: $showsLibrary) {
            LibraryView(onPlay: { story in
                showsLibrary = false
                model.playStored(story)
            }, onClose: { showsLibrary = false })
            .themed(.night)
        }
    }

    private var header: some View {
        HStack {
            BubbleButton(systemImage: "xmark", color: .grape, accessibilityLabel: "Kapat", action: onClose)
            Spacer()
            if model.choiceIndex > 0 {
                StepDots(current: model.choiceIndex, total: 3)
            }
            Spacer()
            if [.region, .mood].contains(model.step) {
                BubbleButton(systemImage: "chevron.left", color: .grape, accessibilityLabel: "Geri") { model.back() }
            } else {
                Color.clear.frame(width: Metrics.minTapTarget, height: Metrics.minTapTarget)
            }
        }
        .padding(.top, Metrics.spacingS)
    }

    @ViewBuilder private var stepContent: some View {
        switch model.step {
        case .greeting:
            VStack(spacing: Metrics.spacingL) {
                CharacterView(character: .pamuk, mood: .sleepy, size: 200)
                VoicePromptPlayer(text: TonightLines.greeting(name: model.childName), recordingKey: nil,
                                  speaker: .pamuk, autoplay: true, showsText: false)
                HStack(spacing: Metrics.spacingXL) {
                    VStack(spacing: 6) {
                        BubbleButton(systemImage: "star.fill", color: .sky, size: .large, accessibilityLabel: "Yeni masal") {
                            model.begin()
                        }
                        Text("Yeni masal").masalFont(.caption, scales: false).foregroundStyle(Palette.nightInk)
                    }
                    VStack(spacing: 6) {
                        BubbleButton(systemImage: "books.vertical.fill", color: .grape, size: .large, accessibilityLabel: "Kitaplığım") {
                            showsLibrary = true
                        }
                        Text("Kitaplığım").masalFont(.caption, scales: false).foregroundStyle(Palette.nightInk)
                    }
                }
            }
        case .character:
            ChoiceStep(prompt: TonightLines.who, onPamuk: model.letPamukChoose) {
                ForEach(model.characterOptions) { c in
                    ChoiceBubbleLarge(label: c.displayName) {
                        CharacterView(character: c, mood: .happy, size: 92, isInteractive: false)
                    } action: { model.choose(c) }
                }
            }
        case .region:
            ChoiceStep(prompt: TonightLines.whereTo, onPamuk: model.letPamukChoose) {
                ForEach(model.regionOptions) { r in
                    ChoiceBubbleLarge(label: r.title, color: r.accent) {
                        Image(systemName: r.symbol).font(.system(size: 44, weight: .heavy)).foregroundStyle(Palette.ink)
                    } action: { model.choose(r) }
                }
            }
        case .mood:
            ChoiceStep(prompt: TonightLines.what, onPamuk: model.letPamukChoose) {
                ForEach(model.moodOptions) { m in
                    ChoiceBubbleLarge(label: m.title, color: m.color) {
                        Image(systemName: m.symbol).font(.system(size: 44, weight: .heavy)).foregroundStyle(Palette.ink)
                    } action: { model.choose(m) }
                }
            }
        case .generating:
            StoryBookWaiting(title: model.title)
        case .libraryOffer:
            LibraryOfferView(onClose: onClose, onOpen: onOpenLibraryStory)
        case .playing:
            EmptyView()
        }
    }
}

/// Bir seçim adımı: sesli soru + 3 büyük baloncuk + "Pamuk seçsin".
private struct ChoiceStep<Options: View>: View {
    let prompt: String
    var onPamuk: () -> Void
    @ViewBuilder var options: () -> Options

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        VStack(spacing: Metrics.spacingL) {
            VoicePromptPlayer(text: prompt, speaker: .pamuk, autoplay: true, showsText: true)
            // iPad yatayda yan yana, telefonda üçgen dizilim (üstte iki, altta ortada bir).
            if sizeClass == .regular {
                HStack(spacing: Metrics.spacingXL) { options() }
            } else {
                TriangleLayout(spacing: Metrics.spacingL) { options() }
            }
            Button(action: onPamuk) {
                HStack(spacing: 8) {
                    CharacterView(character: .pamuk, mood: .happy, size: 44, isInteractive: false)
                    Text(TonightLines.pamukChooses).masalFont(.headline, scales: false)
                }
                .padding(.horizontal, Metrics.spacingM)
                .frame(minHeight: Metrics.minTapTarget)
            }
            .buttonStyle(BubbleButtonStyle(color: .sun))
            .accessibilityHint(Text("Masalı Pamuk seçer"))
        }
    }
}

/// İlk iki görünüm üst satırda, kalanlar alt satırda ortalı.
struct TriangleLayout: Layout {
    var spacing: CGFloat = 24

    private func rows(_ subviews: Subviews) -> [[LayoutSubviews.Element]] {
        [Array(subviews.prefix(2)), Array(subviews.dropFirst(2))].filter { !$0.isEmpty }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = rows(subviews).map { row in
            row.map { $0.sizeThatFits(.unspecified) }
        }
        let width = sizes.map { $0.map(\.width).reduce(0, +) + spacing * CGFloat(max($0.count - 1, 0)) }.max() ?? 0
        let height = sizes.map { $0.map(\.height).max() ?? 0 }.reduce(0, +) + spacing * CGFloat(max(sizes.count - 1, 0))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(subviews) {
            let sizes = row.map { $0.sizeThatFits(.unspecified) }
            let rowWidth = sizes.map(\.width).reduce(0, +) + spacing * CGFloat(row.count - 1)
            var x = bounds.midX - rowWidth / 2
            let rowHeight = sizes.map(\.height).max() ?? 0
            for (view, size) in zip(row, sizes) {
                view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += rowHeight + spacing
        }
    }
}

/// Büyük, resimli seçim baloncuğu (çocuk tarafı: ≥ 96 pt).
private struct ChoiceBubbleLarge<Icon: View>: View {
    let label: String
    var color: AccentColor = .grape
    @ViewBuilder var icon: () -> Icon
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                icon()
                Text(label).masalFont(.caption, scales: false).lineLimit(2).multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)
            }
            .padding(10)
            .frame(width: 140, height: 140)
        }
        .buttonStyle(BubbleButtonStyle(color: color, shape: .circle))
        .accessibilityLabel(Text(label))
    }
}

/// Bekleme: Pamuk kocaman bir kitap açar, sayfalardan yıldızlar çıkar (§3.3 adım 3).
struct StoryBookWaiting: View {
    var title: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var open = false

    var body: some View {
        VStack(spacing: Metrics.spacingL) {
            ZStack {
                if !reduceMotion {
                    TimelineView(.animation(minimumInterval: 1 / 30)) { ctx in
                        FlyingStars(time: ctx.date.timeIntervalSinceReferenceDate)
                    }
                    .frame(width: 320, height: 320)
                    .allowsHitTesting(false)
                }
                OpenBook(open: open)
                    .frame(width: 220, height: 140)
                    .offset(y: 60)
                CharacterView(character: .pamuk, mood: .happy, size: 150, isInteractive: false)
                    .offset(y: -40)
            }
            .frame(height: 320)
            if let title {
                Text(verbatim: title).masalFont(.title).foregroundStyle(Palette.moon)
                    .multilineTextAlignment(.center)
                    .transition(.opacity)
            }
            VoicePromptPlayer(text: TonightLines.writing, speaker: .pamuk, autoplay: true, showsText: false)
        }
        .onAppear {
            withAnimation(reduceMotion ? Motion.reduced : .spring(response: 1.2, dampingFraction: 0.7)) { open = true }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("Masal hazırlanıyor"))
    }
}

private struct OpenBook: View {
    let open: Bool
    var body: some View {
        HStack(spacing: 0) {
            Inked(RoundedRectangle(cornerRadius: 14, style: .continuous), Color(hex: "#FFF1DA"))
                .rotation3DEffect(.degrees(open ? 0 : 80), axis: (x: 0, y: 1, z: 0), anchor: .trailing)
            Inked(RoundedRectangle(cornerRadius: 14, style: .continuous), Color(hex: "#FFF8EC"))
        }
        .background(Inked(RoundedRectangle(cornerRadius: 18, style: .continuous), AccentColor.berry.color(for: .night)).padding(-8))
    }
}

/// Kitaptan yükselip sönen yıldızlar (deterministik).
private struct FlyingStars: View {
    let time: TimeInterval
    private static let seeds = NightSkyBackground.Star.generate(count: 12, seed: 99)

    var body: some View {
        Canvas { ctx, size in
            for (i, s) in Self.seeds.enumerated() {
                let period = 2.4 + s.speed
                let t = ((time + s.phase) .truncatingRemainder(dividingBy: period)) / period
                let x = size.width / 2 + (s.x - 0.5) * size.width * 0.8 * t
                let y = size.height * 0.75 - t * size.height * 0.75
                let r = 6 + s.radius * 3
                let star = RoundedStar().path(in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
                ctx.opacity = 1 - t
                ctx.fill(star, with: .color(i.isMultiple(of: 3) ? Palette.firefly : Palette.moon))
            }
        }
    }
}

/// Günlük yeni masal hakkı dolduğunda (ücretsiz sürüm): satın alma yok, kitaplıktan masal önerisi.
private struct LibraryOfferView: View {
    var onClose: () -> Void
    var onOpen: (LibraryItemDTO) -> Void

    @Environment(AppState.self) private var appState
    @Query private var families: [Family]
    @State private var items: [LibraryItemDTO] = []

    var body: some View {
        VStack(spacing: Metrics.spacingL) {
            CharacterView(character: .nur, mood: .sleepy, size: 150)
            VoicePromptPlayer(text: TonightLines.libraryOffer, speaker: .nur, autoplay: false, showsText: true)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Metrics.spacingM) {
                    ForEach(items) { item in
                        Button { onOpen(item) } label: {
                            StoryCard(title: item.title, region: item.region, durationMinutes: item.durationMinutes,
                                      characters: [item.region.guide], width: 150)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Metrics.spacingM)
            }
        }
        .safeAreaInset(edge: .bottom) {
            // Günlük ücretsiz masal bitti: Premium'u yalnızca ebeveyne, kapının arkasında öner (§3.9).
            if PaywallPolicy.canOffer(family: families.first) { ForParentsLink() }
        }
        .task {
            let owned = Set(families.first?.entitlement?.ownedProductIDs ?? [])
            items = ((try? await appState.api.library()) ?? [])
                .filter { PackVisibility.isPlayableWithoutPremium($0, ownedPacks: owned) }.prefix(4).map { $0 }
        }
    }
}

extension StoryMood {
    var symbol: String {
        switch self {
        case .adventure: "map.fill"
        case .funny: "face.smiling.inverse"
        case .calm: "moon.zzz.fill"
        }
    }
    var color: AccentColor {
        switch self {
        case .adventure: .orange
        case .funny: .sun
        case .calm: .sky
        }
    }
}

#Preview("Bu Gece") {
    TonightFlowView()
        .environment(AppState())
        .modelContainer(PersistenceController.preview.container)
}
