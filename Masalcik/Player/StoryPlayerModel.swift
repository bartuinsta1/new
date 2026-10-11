import SwiftUI
import SwiftData
import Observation

/// Masal Oynatıcı durumu: ses motoru + ilerleme + kararma + kilit ekranı + kayıt.
/// Hem tamamı hazır masalı (kitaplık, tekrar dinleme) hem akışla gelen masalı ("Bu Gece", Adım 7) çalar.
@MainActor
@Observable
final class StoryPlayerModel {
    let story: Story
    let engine: StoryAudioEngine
    let subtitlesEnabled: Bool
    private let childName: String?
    private let child: ChildProfile?
    private let expectedParagraphs: Int
    private let nowPlaying = NowPlayingController()
    private let dimmer = ScreenDimmer()
    private var started = false
    private var markedFinished = false
    private var startedAt = Date.now

    init(story: Story, child: ChildProfile?, settings: AppSettings?, language: AppLanguage = .current) {
        self.story = story
        self.childName = child?.name
        self.child = child
        self.subtitlesEnabled = settings?.subtitlesEnabled ?? false
        // Süreye göre beklenen paragraf sayısı (akış sürerken ilerleme tahmini için; backend ile aynı tablo).
        self.expectedParagraphs = [5: 8, 10: 14, 15: 20][story.durationMinutes] ?? 10
        let spoken = child?.spokenName
        let goodnight = spoken.map { String(localized: "İyi geceler, \($0)!") } ?? String(localized: "İyi geceler!")
        self.engine = StoryAudioEngine(language: language, goodnightText: goodnight,
                                       afterStorySound: settings?.afterStorySound ?? .lullaby,
                                       afterStoryMinutes: settings?.lullabyMinutesAfterStory ?? 15)
        engine.backgroundLullaby = settings?.backgroundLullabyEnabled ?? false
        // Kayıtlı paragrafları kuyruğa ekle (yerel dosya > uzak ses > cihaz sesi).
        for p in story.orderedParagraphs { engine.append(Self.segment(for: p, storyID: story.id)) }
        engine.onPhaseChange = { [weak self] phase in self?.phaseChanged(phase) }
    }

    static func segment(for p: StoryParagraph, storyID: String) -> AudioSegment {
        SegmentPlanner.segment(text: p.text, emotion: p.emotion, audioURL: p.audioURL,
                               localFile: p.localAudioFileName.map { AudioDownloader.localURL(storyID: storyID, fileName: $0) })
    }

    // MARK: Akış ("Bu Gece")

    /// Akışla yeni paragraf geldi: modele yaz ve kuyruğa ekle.
    func appendStreamed(_ dto: ParagraphDTO) {
        let p = StoryParagraph(index: dto.index, text: dto.text, sceneHint: dto.sceneHint, emotion: dto.emotion, audioURL: dto.audioUrl)
        story.paragraphs.append(p)
        engine.append(Self.segment(for: p, storyID: story.id))
    }

    func streamCompleted() { engine.finishStream() }

    // MARK: Yaşam döngüsü

    func start() {
        guard !started else { return }
        started = true
        startedAt = .now
        if isCompleteStory { engine.finishStream() }
        UIApplication.shared.isIdleTimerDisabled = true       // masal boyunca ekran kilitlenmez; kararma görünür
        Analytics.shared.track(.storyStarted(region: story.region, mood: story.mood, isLibrary: story.isLibraryStory))
        nowPlaying.activate(
            title: story.title,
            artwork: NowPlayingController.renderArtwork(region: story.region, character: story.characters.first ?? .pamuk),
            estimatedDuration: TimeInterval(story.durationMinutes * 60),
            onPlay: { [weak self] in self?.engine.play() },
            onPause: { [weak self] in self?.engine.pause() })
        engine.play()
    }

    /// Tamamı kayıtlı masal mı? Kitaplık ve tekrar dinleme: evet. "Bu Gece" akışı: hayır —
    /// akış bitince `streamCompleted()` çağrılır. `start()`tan önce ayarlanmalı.
    var isCompleteStory = true

    func close() {
        engine.stop()
        nowPlaying.deactivate()
        dimmer.restore()
        UIApplication.shared.isIdleTimerDisabled = false
    }

    /// Uygulama arka plana geçince parlaklık iade edilir (ses devam eder).
    func didEnterBackground() { dimmer.restore() }

    // MARK: Türetilmiş durum

    /// 0…1 masal ilerlemesi. Akış sürerken gelmemiş paragraflar ortalama uzunlukta varsayılır.
    var progress: Double {
        switch engine.phase {
        case .goodnight, .afterStorySound, .finished: return 1
        default: break
        }
        var texts = engine.segments.map(\.text)
        if !engine.isStreamComplete && texts.count < expectedParagraphs {
            let avg = texts.isEmpty ? "" : String(repeating: "x", count: texts.map(\.count).reduce(0, +) / texts.count)
            texts += Array(repeating: avg, count: expectedParagraphs - texts.count)
        }
        return PlaybackProgress(texts: texts).fraction(segmentIndex: engine.segmentIndex, segmentFraction: engine.segmentFraction)
    }

    /// Ekran kararması: son %20'de neredeyse siyah; masal bitince tamamen karanlık kalır.
    var dimming: Double { DimmingCurve.dimming(forProgress: progress) }

    /// Karaoke altyazı için o anki paragraf metni ve kelime sırası.
    var subtitle: (text: String, wordIndex: Int?)? {
        guard engine.segmentIndex < engine.segments.count else { return nil }
        let text = engine.segments[engine.segmentIndex].text
        return (text, engine.speechWordIndex ?? KaraokeTiming.wordIndex(in: text, fraction: engine.segmentFraction))
    }

    func tick() {
        dimmer.apply(dimming: dimming)
        nowPlaying.update(elapsed: progress * TimeInterval(story.durationMinutes * 60), isPlaying: engine.isPlaying)
    }

    private func phaseChanged(_ phase: PlaybackPhase) {
        nowPlaying.update(elapsed: progress * TimeInterval(story.durationMinutes * 60), isPlaying: engine.isPlaying)
        switch phase {
        case .goodnight:
            markPlayed()
        case .finished:
            markPlayed()
            // Ekran artık kendi kendine kilitlenebilir; ses zaten durdu.
            UIApplication.shared.isIdleTimerDisabled = false
            nowPlaying.deactivate()
        default:
            break
        }
    }

    /// Masal dinlendi: sayaç, ödüller (çıkartma, 7 gece kıyafeti) ve çevrimdışı indirme.
    /// Ödüller sessizce sandığa girer; uyumak üzere olan çocuğa kutlama ekranı gösterilmez.
    private func markPlayed() {
        guard !markedFinished else { return }
        markedFinished = true
        story.playCount += 1
        story.lastPlayedAt = .now
        if let child { RewardEngine.storyFinished(story, child: child) }
        Analytics.shared.track(.storyFinished(durationSeconds: Int(Date.now.timeIntervalSince(startedAt))))
        let story = self.story
        Task { await AudioDownloader.download(story) }
    }
}
