import SwiftUI
import Observation

/// Masal Adası ekranının durumu: kamera, seçili bölge, bölge masalları, kilitler.
@MainActor
@Observable
final class WorldViewModel {
    var camera = MapCamera(center: WorldLayout.position(of: .sleepHouse), zoom: 0.6)
    private(set) var selectedRegion: Region?
    private(set) var library: [LibraryItemDTO] = []
    /// Kilitli bölgeye dokununca kısa "esneme" geri bildirimi için.
    private(set) var nudgedRegion: Region?

    var listenedStories = 0
    var hasValueTopics = false
    var isPremium = false

    @ObservationIgnored private let api: StoryAPI
    @ObservationIgnored private var hasGreeted = false
    @ObservationIgnored private var hasNudgedBedtime = false

    init(api: StoryAPI) { self.api = api }

    func load() async {
        library = (try? await api.library()) ?? []
    }

    func isUnlocked(_ region: Region) -> Bool {
        RegionUnlocks.isUnlocked(region, listenedStories: listenedStories, hasValueTopics: hasValueTopics)
    }

    /// Bölgenin masal kartları: en fazla 6 (§3.2). Ücretsiz olanlar önce.
    func stories(for region: Region) -> [LibraryItemDTO] {
        Array(library.filter { $0.region == region }.sorted { $0.isFree && !$1.isFree }.prefix(6))
    }

    /// Ücretli masal, premium değilse "uyuyan kart" olarak gösterilir.
    func isSleeping(_ item: LibraryItemDTO) -> Bool { !item.isFree && !isPremium }

    func greetIfNeeded(isBedtimeNear: Bool) {
        if isBedtimeNear && !hasNudgedBedtime {
            hasNudgedBedtime = true
            hasGreeted = true
            VoicePrompter.shared.speak(WorldLines.bedtime, recordingKey: "vp_bedtime")
        } else if !hasGreeted {
            hasGreeted = true
            VoicePrompter.shared.speak(WorldLines.mapHint, recordingKey: "vp_map_hint")
        }
    }

    /// Bölgeye dokunma. Açıksa kamera yakınlaşır, rehber konuşur, kartlar çıkar; kilitliyse bulut esner.
    func tap(_ region: Region, viewport: CGSize, reduceMotion: Bool, mode: DisplayMode) {
        guard isUnlocked(region) else {
            VoicePrompter.shared.speak(WorldLines.regionSleeping, recordingKey: "vp_region_sleeping")
            nudgedRegion = region
            Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(700))
                self?.nudgedRegion = nil
            }
            return
        }
        selectedRegion = region
        VoicePrompter.shared.speak(WorldLines.intro(for: region), recordingKey: "vp_intro_\(region.rawValue)")
        withAnimation(Motion.standard(mode, reduceMotion: reduceMotion)) {
            camera = MapCamera.focusing(on: WorldLayout.position(of: region), viewport: viewport, verticalBias: 0.18)
                .clamped(world: WorldLayout.size, viewport: viewport)
        }
    }

    func dismissRegion(viewport: CGSize, reduceMotion: Bool, mode: DisplayMode) {
        selectedRegion = nil
        withAnimation(Motion.standard(mode, reduceMotion: reduceMotion)) {
            camera = MapCamera(center: camera.center, zoom: WorldLayout.initialZoom(for: viewport))
                .clamped(world: WorldLayout.size, viewport: viewport)
        }
    }

    func commitPan(_ translation: CGSize, viewport: CGSize) {
        camera = camera.panned(by: translation).clamped(world: WorldLayout.size, viewport: viewport)
    }

    func commitZoom(_ factor: CGFloat, viewport: CGSize) {
        camera = camera.zoomed(by: factor).clamped(world: WorldLayout.size, viewport: viewport)
    }

    /// İlk açılış: Uyku Evi ortada, cihaza uygun yakınlaştırma.
    func resetCamera(viewport: CGSize) {
        camera = MapCamera(center: WorldLayout.position(of: .sleepHouse), zoom: WorldLayout.initialZoom(for: viewport))
            .clamped(world: WorldLayout.size, viewport: viewport)
    }

    /// VoiceOver açıkken tüm adayı sığdır: kaydırmadan her bölgeye ulaşılsın.
    func fitWholeIsland(viewport: CGSize) {
        camera = MapCamera(center: WorldLayout.islandCenter, zoom: MapCamera.minZoom)
            .clamped(world: WorldLayout.size, viewport: viewport)
    }
}
