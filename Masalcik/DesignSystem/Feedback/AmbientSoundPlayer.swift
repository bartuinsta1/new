import AVFoundation

/// Arka plan ortam sesi (§2.6): gündüz kuş cıvıltısı, gece cırcır böceği. Ebeveyn kapatabilir.
/// Ses dosyaları (`ambient_day.m4a`, `ambient_night.m4a`) pakette yoksa sessizce hiçbir şey yapmaz.
/// Oturum `.ambient`: kullanıcının çalan müziğini kesmez, sessiz moda uyar. Masal oynatıcı `.playback`'e geçer (Adım 6).
@MainActor
final class AmbientSoundPlayer {
    static let shared = AmbientSoundPlayer()
    private var player: AVAudioPlayer?
    private var currentMode: DisplayMode?
    var isEnabled = true { didSet { if !isEnabled { stop() } } }

    func play(for mode: DisplayMode) {
        guard isEnabled, currentMode != mode else { return }
        stop()
        let name = mode == .day ? "ambient_day" : "ambient_night"
        guard let url = Bundle.main.url(forResource: name, withExtension: "m4a"),
              let p = try? AVAudioPlayer(contentsOf: url) else { return }
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
        p.numberOfLoops = -1
        p.volume = mode == .day ? 0.25 : 0.18
        p.play()
        player = p
        currentMode = mode
    }

    func stop() {
        player?.stop()
        player = nil
        currentMode = nil
    }
}
