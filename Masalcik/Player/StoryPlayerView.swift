import SwiftUI
import SwiftData

/// Masal Oynatıcı — Gece Modu (§3.4).
/// Tam ekran alacakaranlık sahnesi, yavaş nefes alan karakterler, az ve büyük denetim:
/// oynat/duraklat, uyku zamanlayıcı, ninni fonu. Altyazı varsayılan kapalı (ebeveyn açar; karaoke).
/// Masal ilerledikçe ekran kararır; bitince "İyi geceler" der ve sessizce durur — sıradaki masal başlamaz.
struct StoryPlayerView: View {
    @State var model: StoryPlayerModel
    var onClose: () -> Void = {}

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            NightSkyBackground(showsFireflies: !reduceMotion)
            scene
            VStack {
                topBar
                Spacer()
                if model.subtitlesEnabled, let sub = model.subtitle, isStoryPhase {
                    KaraokeSubtitle(text: sub.text, wordIndex: sub.wordIndex)
                        .padding(.horizontal, Metrics.spacingM)
                        .transition(.opacity)
                }
                controls
                    .padding(.bottom, Metrics.spacingXL)
            }
            // Kademeli kararma: denetimler dahil her şeyin üstünde, dokunmayı engellemez.
            Color.black.opacity(model.dimming)
                .ignoresSafeArea()
                .allowsHitTesting(false)
                .animation(.easeInOut(duration: 2), value: model.dimming)
        }
        .themed(.night)
        .statusBarHidden()
        .onAppear { model.start() }
        .onDisappear { model.close() }
        .onChange(of: scenePhase) { _, phase in if phase != .active { model.didEnterBackground() } }
        .task {
            while !Task.isCancelled {
                model.tick()
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    private var isStoryPhase: Bool {
        switch model.engine.phase {
        case .playing, .paused, .waitingForAudio: true
        default: false
        }
    }

    // MARK: Sahne

    private var scene: some View {
        GeometryReader { geo in
            let lead = model.story.characters.first ?? .pamuk
            let second = model.story.characters.dropFirst().first
            ZStack(alignment: .bottom) {
                Ellipse()
                    .fill(model.story.region.accent.color(for: .night).darkened(0.35))
                    .frame(width: geo.size.width * 1.6, height: geo.size.height * 0.45)
                    .offset(y: geo.size.height * 0.2)
                HStack(alignment: .bottom, spacing: -10) {
                    // Gece animasyonları yavaş: CharacterView gece temasında 2.4 sn nefes alır.
                    CharacterView(character: lead, mood: .sleepy, size: min(geo.size.width * 0.42, 220), isInteractive: false)
                    if let second {
                        CharacterView(character: second, mood: .sleepy, size: min(geo.size.width * 0.32, 170), isInteractive: false)
                    }
                }
                .padding(.bottom, geo.size.height * 0.3)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    // MARK: Üst

    private var topBar: some View {
        HStack {
            BubbleButton(systemImage: "xmark", color: .grape, accessibilityLabel: "Kapat") {
                model.close()
                onClose()
            }
            Spacer()
            if case .waitingForAudio = model.engine.phase {
                Image(systemName: "sparkles")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(Palette.moon)
                    .symbolEffect(.pulse, isActive: !reduceMotion)
                    .accessibilityLabel(Text("Masal hazırlanıyor"))
            }
        }
        .padding(.horizontal, Metrics.spacingM)
        .padding(.top, Metrics.spacingS)
    }

    // MARK: Denetimler (az ve büyük)

    private var controls: some View {
        HStack(alignment: .center, spacing: Metrics.spacingL) {
            VStack(spacing: 6) {
                BubbleButton(systemImage: "moon.zzz.fill", color: .grape, accessibilityLabel: "Uyku zamanlayıcı") {
                    model.engine.sleepTimer = model.engine.sleepTimer.next
                }
                .accessibilityValue(Text(model.engine.sleepTimer.label))
                Text(model.engine.sleepTimer.label)
                    .masalFont(.caption, scales: false)
                    .foregroundStyle(Palette.nightInk.opacity(0.8))
            }
            playPause
            VStack(spacing: 6) {
                BubbleButton(systemImage: model.engine.backgroundLullaby ? "music.note" : "music.note.slash",
                             color: model.engine.backgroundLullaby ? .sky : .grape, accessibilityLabel: "Ninni fonu") {
                    model.engine.backgroundLullaby.toggle()
                }
                .accessibilityValue(model.engine.backgroundLullaby ? Text("Açık") : Text("Kapalı"))
                (model.engine.backgroundLullaby ? Text("Ninni açık") : Text("Ninni kapalı"))
                    .masalFont(.caption, scales: false)
                    .foregroundStyle(Palette.nightInk.opacity(0.8))
            }
        }
    }

    @ViewBuilder private var playPause: some View {
        switch model.engine.phase {
        case .goodnight, .afterStorySound, .finished:
            // Bitti: yeniden oynat ya da sıradaki masal düğmesi YOK (uyku dostu).
            Image(systemName: "moon.stars.fill")
                .font(.system(size: 44))
                .foregroundStyle(Palette.moon)
                .frame(width: Metrics.primaryTapTarget, height: Metrics.primaryTapTarget)
                .accessibilityLabel(Text("İyi geceler"))
        default:
            BubbleButton(systemImage: model.engine.phase == .playing ? "pause.fill" : "play.fill",
                         color: .sky, size: .large,
                         accessibilityLabel: model.engine.phase == .playing ? "Duraklat" : "Oynat") {
                model.engine.togglePlayPause()
            }
        }
    }
}

/// Karaoke altyazı: okunan kelimeye kadar parlak, sonrası soluk. Ebeveyn ayarıyla açılır (§3.4).
struct KaraokeSubtitle: View {
    let text: String
    let wordIndex: Int?

    var body: some View {
        Text(attributed)
            .masalFont(.headline)
            .multilineTextAlignment(.center)
            .padding(Metrics.spacingM)
            .frame(maxWidth: 640)
            .background(RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous).fill(Palette.nightSky.opacity(0.7)))
            .accessibilityLabel(Text(text))
    }

    private var attributed: AttributedString {
        let ranges = KaraokeTiming.wordRanges(in: text)
        let end = wordIndex.flatMap { $0 < ranges.count ? ranges[$0].upperBound : nil } ?? text.startIndex
        var read = AttributedString(String(text[..<end]))
        read.foregroundColor = Palette.moon
        var rest = AttributedString(String(text[end...]))
        rest.foregroundColor = Palette.nightInk.opacity(0.45)
        return read + rest
    }
}

/// Kitaplık masalını (sunucu/CDN) yükleyip oynatıcıyı açar. Çevrimdışıysa daha önce indirilmiş kopya kullanılır.
struct LibraryStoryPlayerContainer: View {
    let item: LibraryItemDTO
    var onClose: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var context
    @Query private var families: [Family]
    @State private var model: StoryPlayerModel?

    var body: some View {
        ZStack {
            if let model {
                StoryPlayerView(model: model, onClose: onClose)
            } else {
                NightSkyBackground()
                CharacterView(character: item.region.guide, mood: .sleepy, size: 160, isInteractive: false)
            }
        }
        .task { await load() }
    }

    private func load() async {
        let story: Story
        let id = item.id
        if let existing = try? context.fetch(FetchDescriptor<Story>(predicate: #Predicate { $0.id == id })).first,
           !existing.paragraphs.isEmpty {
            story = existing
        } else if let dto = try? await appState.api.story(id: item.id) {
            story = StoryEngineClient.makeStory(from: dto)
            story.isLibraryStory = true
            context.insert(story)
        } else {
            // Çevrimdışı ve indirilmemiş: güvenli yerel masal (sahte içerik) — çocuk hata görmez.
            let child = families.first?.children.first
            let req = MockStoryAPI.previewRequest(language: .current)
            story = StoryEngineClient.makeStory(from: MockStoryAPI.sampleStory(for: child.map {
                StoryEngineClient.makeRequest(child: $0, settings: AppSettings(), region: item.region, mood: .calm)
            } ?? req))
            context.insert(story)
        }
        let family = families.first
        model = StoryPlayerModel(story: story, child: family?.children.first, settings: family?.settings)
    }
}

#Preview("Oynatıcı") {
    let container = PersistenceController.preview.container
    let story = try! container.mainContext.fetch(FetchDescriptor<Story>()).first!
    return StoryPlayerView(model: StoryPlayerModel(story: story, child: nil, settings: AppSettings(subtitlesEnabled: true)))
        .modelContainer(container)
}
