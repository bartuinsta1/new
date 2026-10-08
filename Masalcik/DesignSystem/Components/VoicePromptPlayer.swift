import SwiftUI
import AVFoundation

/// Sesli yönergeler ve karakter replikleri için oynatıcı (§2.1: çocuk tarafında her eylemin sesli yönergesi var).
/// Önce paketteki profesyonel kaydı (`Resources/VoicePrompts/<key>.m4a`) arar; yoksa cihaz içi tr-TR sesle okur.
@MainActor
final class VoicePrompter: NSObject {
    static let shared = VoicePrompter()

    private let synth = AVSpeechSynthesizer()
    private var player: AVAudioPlayer?
    /// Masal oynatıcısı çalarken yönergeler susturulur.
    var isMuted = false

    func speak(_ text: String, recordingKey: String? = nil) {
        guard !isMuted else { return }
        stop()
        if let key = recordingKey,
           let url = Bundle.main.url(forResource: key, withExtension: "m4a"),
           let p = try? AVAudioPlayer(contentsOf: url) {
            player = p
            p.play()
            return
        }
        let u = AVSpeechUtterance(string: text)
        u.voice = AVSpeechSynthesisVoice(language: "tr-TR")
        u.rate = AVSpeechUtteranceDefaultSpeechRate * 0.85   // §4.5: ~%85 hız
        u.pitchMultiplier = 1.1
        synth.speak(u)
    }

    func stop() {
        player?.stop()
        if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
    }
}

/// Ekrandaki sesli yönerge: konuşan karakter + hoparlör balonu. Görünür olunca bir kez okur, dokununca tekrarlar.
struct VoicePromptPlayer: View {
    let text: String
    var recordingKey: String?
    var speaker: CharacterID = .pamuk
    var autoplay = true
    /// Çocuk okuyamayabilir; metin balonu varsayılan olarak gizli, yalnızca hoparlör simgesi görünür.
    var showsText = false

    @Environment(\.theme) private var theme
    @State private var pulse = false

    var body: some View {
        HStack(spacing: Metrics.spacingS) {
            CharacterView(character: speaker, size: 72, isInteractive: false)
            Button(action: play) {
                HStack(spacing: Metrics.spacingS) {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 24, weight: .heavy))
                        .scaleEffect(pulse ? 1.15 : 1)
                    if showsText {
                        Text(text).masalFont(.bodyBold, scales: false).multilineTextAlignment(.leading)
                    }
                }
                .padding(.horizontal, Metrics.spacingM)
                .frame(minWidth: Metrics.minTapTarget, minHeight: Metrics.minTapTarget)
            }
            .buttonStyle(BubbleButtonStyle(color: .sky, shape: showsText ? .rounded : .circle))
            .accessibilityLabel(Text(text))
            .accessibilityHint(Text("Tekrar dinlemek için dokun"))
        }
        .onAppear { if autoplay { play() } }
    }

    private func play() {
        VoicePrompter.shared.speak(text, recordingKey: recordingKey)
        withAnimation(.easeInOut(duration: 0.3).repeatCount(3, autoreverses: true)) { pulse.toggle() }
    }
}

#Preview("VoicePromptPlayer") {
    VStack(spacing: 24) {
        VoicePromptPlayer(text: "Masal seçmek için yıldıza dokun!", autoplay: false)
        VoicePromptPlayer(text: "Masal seçmek için yıldıza dokun!", speaker: .yildiz, autoplay: false, showsText: true)
    }
    .padding()
    .background(Palette.cream)
    .themed(.day)
}
