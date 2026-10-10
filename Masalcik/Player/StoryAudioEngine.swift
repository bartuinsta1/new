import AVFoundation
import Observation

/// Masalın ses motoru (§3.4, §4.5).
/// - Paragraflar akış hâlinde eklenir; ilk paragraf gelir gelmez çalmaya başlar.
/// - Ses dosyası (yerel/uzak) yoksa ya da yüklenemezse o paragraf cihaz içi sesle okunur (çocuk hata görmez).
/// - Masal bitince "İyi geceler, Ayşe", isteğe bağlı ninni/beyaz gürültü, sonra sessizce durur.
///   Sıradaki masal otomatik BAŞLAMAZ.
/// - Uyku zamanlayıcı: sabit sürede ses 30 sn'de yavaşça kısılıp durur.
@MainActor
@Observable
final class StoryAudioEngine: NSObject {
    private(set) var phase: PlaybackPhase = .waitingForAudio
    private(set) var segments: [AudioSegment] = []
    private(set) var segmentIndex = 0
    /// O anki paragrafın çalınan oranı (0…1).
    private(set) var segmentFraction: Double = 0
    /// Cihaz sentezinde gerçek kelime konumu (karaoke); dosya çalarken nil (oranla tahmin edilir).
    private(set) var speechWordIndex: Int?
    private(set) var isStreamComplete = false

    var sleepTimer: SleepTimerOption = .endOfStory {
        didSet { scheduleSleepTimer() }
    }
    var backgroundLullaby = false {
        didSet { updateBackgroundLullaby() }
    }
    var onPhaseChange: (@MainActor (PlaybackPhase) -> Void)?

    private let language: AppLanguage
    private let goodnightText: String
    private let afterStorySound: AfterStorySound
    private let afterStoryMinutes: Int

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var statusObservation: NSKeyValueObservation?
    private let synth = AVSpeechSynthesizer()
    private var speakingGoodnight = false
    private var bedPlayer: AVAudioPlayer?        // ninni fonu / masal sonrası ses
    /// Model kurulurken kuyruk dolsa da çalma, oynatıcı ekranı açılıp `play()` çağrılınca başlar.
    private var wantsToPlay = false
    private var masterVolume: Float = 1
    private var timerTask: Task<Void, Never>?
    private var afterStoryTask: Task<Void, Never>?
    private var interruptionObserver: NSObjectProtocol?

    init(language: AppLanguage = .current, goodnightText: String,
         afterStorySound: AfterStorySound = .lullaby, afterStoryMinutes: Int = 15) {
        self.language = language
        self.goodnightText = goodnightText
        self.afterStorySound = afterStorySound
        self.afterStoryMinutes = afterStoryMinutes
        super.init()
        synth.delegate = self
        observeInterruptions()
    }

    // MARK: Akış

    func append(_ segment: AudioSegment) {
        segments.append(segment)
        if phase == .waitingForAudio && wantsToPlay && segmentIndex == segments.count - 1 { playCurrent() }
    }

    /// Tüm paragraflar geldi. Son paragraf çoktan bittiyse "iyi geceler"e geçilir.
    func finishStream() {
        isStreamComplete = true
        if phase == .waitingForAudio && segmentIndex >= segments.count && !segments.isEmpty { startGoodnight() }
    }

    // MARK: Denetimler

    func play() {
        wantsToPlay = true
        switch phase {
        case .paused:
            if synth.isPaused { synth.continueSpeaking() } else if let player { player.play() } else { playCurrent() }
            bedPlayer?.play()
            setPhase(.playing)
        case .waitingForAudio:
            if segmentIndex < segments.count { playCurrent() }
        default: break
        }
    }

    func pause() {
        wantsToPlay = false
        guard phase == .playing || phase == .waitingForAudio else { return }
        player?.pause()
        if synth.isSpeaking { synth.pauseSpeaking(at: .word) }
        bedPlayer?.pause()
        setPhase(.paused)
    }

    func togglePlayPause() { phase == .playing ? pause() : play() }

    /// Oynatıcı kapanırken: her şeyi durdur.
    func stop() {
        timerTask?.cancel()
        afterStoryTask?.cancel()
        tearDownPlayer()
        synth.stopSpeaking(at: .immediate)
        bedPlayer?.stop()
        bedPlayer = nil
        if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) }
    }

    var isPlaying: Bool { phase == .playing || phase == .goodnight }

    // MARK: Segment çalma

    private func playCurrent() {
        tearDownPlayer()
        segmentFraction = 0
        speechWordIndex = nil
        guard segmentIndex < segments.count else {
            if isStreamComplete { startGoodnight() } else { setPhase(.waitingForAudio) }
            return
        }
        AudioSessionController.activate()
        switch segments[segmentIndex] {
        case .file(let url, _), .remote(let url, _):
            playAudio(url)
        case .speech(let text, let emotion):
            speak(text, emotion: emotion)
        }
        setPhase(.playing)
    }

    private func playAudio(_ url: URL) {
        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        player.volume = masterVolume
        self.player = player
        let index = segmentIndex
        // Uzak ses yüklenemezse (ağ yok) aynı paragrafı cihaz sesiyle oku.
        statusObservation = item.observe(\.status) { [weak self] item, _ in
            guard item.status == .failed else { return }
            Task { @MainActor in self?.fallBackToSpeech(at: index) }
        }
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.25, preferredTimescale: 600), queue: .main) { [weak self] time in
            MainActor.assumeIsolated {
                guard let self, let duration = self.player?.currentItem?.duration.seconds, duration.isFinite, duration > 0 else { return }
                self.segmentFraction = min(time.seconds / duration, 1)
            }
        }
        endObserver = NotificationCenter.default.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.advance() }
        }
        player.play()
    }

    private func fallBackToSpeech(at index: Int) {
        guard index == segmentIndex, index < segments.count else { return }
        segments[index] = .speech(text: segments[index].text, emotion: .neutral)
        playCurrent()
    }

    private func speak(_ text: String, emotion: ParagraphEmotion) {
        let u = AVSpeechUtterance(string: text)
        u.voice = AVSpeechSynthesisVoice(language: language.speechCode)
        let base = AVSpeechUtteranceDefaultSpeechRate * 0.85     // §4.5: ~%85 hız
        switch emotion {
        case .neutral: u.rate = base
        case .smiling: u.rate = base; u.pitchMultiplier = 1.08
        case .surprised: u.rate = base * 1.05; u.pitchMultiplier = 1.15
        case .whisper: u.rate = base * 0.95; u.pitchMultiplier = 0.95; u.volume = 0.6
        case .sleepy: u.rate = base * 0.88; u.pitchMultiplier = 0.92; u.volume = 0.75
        }
        u.volume *= masterVolume
        u.postUtteranceDelay = 0.6
        synth.speak(u)
    }

    private func advance() {
        segmentIndex += 1
        if wantsToPlay { playCurrent() } else { tearDownPlayer(); setPhase(.paused) }
    }

    private func tearDownPlayer() {
        if let timeObserver, let player { player.removeTimeObserver(timeObserver) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        statusObservation?.invalidate()
        player?.pause()
        player = nil
        timeObserver = nil
        endObserver = nil
        statusObservation = nil
    }

    // MARK: Masal sonu

    private func startGoodnight() {
        tearDownPlayer()
        segmentFraction = 1
        setPhase(.goodnight)
        speakingGoodnight = true
        let u = AVSpeechUtterance(string: goodnightText)
        u.voice = AVSpeechSynthesisVoice(language: language.speechCode)
        u.rate = AVSpeechUtteranceDefaultSpeechRate * 0.75
        u.pitchMultiplier = 0.95
        u.volume = 0.8 * masterVolume
        u.preUtteranceDelay = 1.0
        synth.speak(u)
    }

    private func startAfterStorySound() {
        speakingGoodnight = false
        guard afterStoryMinutes > 0, sleepTimer == .endOfStory || timerDeadline.map({ $0 > .now }) == true,
              let player = loadBedPlayer(afterStorySound.resourceName) else {
            finish()
            return
        }
        player.volume = 0.35 * masterVolume
        player.play()
        bedPlayer = player
        let endsAt = Date.now.addingTimeInterval(TimeInterval(afterStoryMinutes * 60))
        setPhase(.afterStorySound(endsAt: endsAt))
        afterStoryTask = Task { [weak self] in
            let wait = max(endsAt.timeIntervalSinceNow - VolumeFade.duration, 0)
            try? await Task.sleep(for: .seconds(wait))
            guard !Task.isCancelled else { return }
            await self?.fadeOutAndFinish()
        }
    }

    private func finish() {
        timerTask?.cancel()
        afterStoryTask?.cancel()
        tearDownPlayer()
        synth.stopSpeaking(at: .immediate)
        bedPlayer?.stop()
        bedPlayer = nil
        setPhase(.finished)
        AudioSessionController.deactivate()
    }

    // MARK: Uyku zamanlayıcı

    private var timerStart = Date.now
    private var timerDeadline: Date? { sleepTimer.deadline(from: timerStart) }

    private func scheduleSleepTimer() {
        timerTask?.cancel()
        timerStart = .now
        guard let deadline = timerDeadline else { return }
        timerTask = Task { [weak self] in
            let wait = max(deadline.timeIntervalSinceNow - VolumeFade.duration, 0)
            try? await Task.sleep(for: .seconds(wait))
            guard !Task.isCancelled else { return }
            await self?.fadeOutAndFinish()
        }
    }

    /// 30 sn'de yumuşakça kıs, sonra dur. Ani kesilme çocuğu uyandırabilir.
    private func fadeOutAndFinish() async {
        let start = masterVolume
        let steps = 30
        for step in 0...steps {
            if Task.isCancelled { return }
            let v = VolumeFade.volume(from: start, elapsed: VolumeFade.duration * Double(step) / Double(steps))
            applyVolume(v)
            try? await Task.sleep(for: .seconds(VolumeFade.duration / Double(steps)))
        }
        finish()
    }

    private func applyVolume(_ v: Float) {
        masterVolume = v
        player?.volume = v
        // Masal sonrası ses 0.35, masal altındaki ninni fonu 0.12 seviyesinden kısılır.
        if case .afterStorySound = phase { bedPlayer?.volume = 0.35 * v } else { bedPlayer?.volume = 0.12 * v }
    }

    // MARK: Ninni fonu

    private func updateBackgroundLullaby() {
        if case .afterStorySound = phase { return }
        if backgroundLullaby {
            guard bedPlayer == nil, let p = loadBedPlayer("lullaby") else { return }
            p.volume = 0.12 * masterVolume     // anlatımın altında, çok alçak
            if phase == .playing { p.play() }
            bedPlayer = p
        } else {
            bedPlayer?.stop()
            bedPlayer = nil
        }
    }

    private func loadBedPlayer(_ name: String) -> AVAudioPlayer? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "m4a"),
              let p = try? AVAudioPlayer(contentsOf: url) else { return nil }
        p.numberOfLoops = -1
        return p
    }

    // MARK: Kesintiler (telefon, alarm)

    private func observeInterruptions() {
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] note in
            let type = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt).flatMap(AVAudioSession.InterruptionType.init)
            let options = (note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt).map(AVAudioSession.InterruptionOptions.init)
            MainActor.assumeIsolated {
                guard let self else { return }
                if type == .began { self.pause() }
                else if type == .ended, options?.contains(.shouldResume) == true { self.play() }
            }
        }
    }

    private func setPhase(_ p: PlaybackPhase) {
        guard phase != p else { return }
        phase = p
        onPhaseChange?(p)
    }

    // Senkron delegate geri çağrıları ana aktöre taşınır.
    fileprivate func speechProgress(location: Int, length: Int) {
        guard !speakingGoodnight, segmentIndex < segments.count else { return }
        segmentFraction = length > 0 ? Double(location) / Double(length) : 0
        speechWordIndex = KaraokeTiming.wordIndex(in: segments[segmentIndex].text, utf16Location: location)
    }

    fileprivate func speechFinished() {
        if speakingGoodnight { startAfterStorySound() } else { advance() }
    }
}

extension StoryAudioEngine: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.speechFinished() }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange,
                                       utterance: AVSpeechUtterance) {
        let location = characterRange.location
        let length = utterance.speechString.utf16.count
        Task { @MainActor in self.speechProgress(location: location, length: length) }
    }
}

/// Ses oturumu: `.playback` + `.spokenAudio` → sessiz modda ve kilit ekranında çalar, diğer seslerle karışmaz.
enum AudioSessionController {
    @MainActor static func activate() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [])
        try? session.setActive(true)
    }

    @MainActor static func deactivate() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
