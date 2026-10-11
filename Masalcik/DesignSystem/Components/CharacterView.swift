import SwiftUI

/// Her karakterin 2 sesli tepki repliği (§2.4).
/// VARSAYIM: Profesyonel kayıtlar gelene kadar `VoicePrompter` bu metinleri cihaz içi Türkçe sesle okur.
extension CharacterID {
    var reactionLines: [String] {
        switch self {
        case .pamuk: [String(localized: "Hıh… ah, merhaba! Biraz uykum var da…"),
                      String(localized: "Gıdıklanıyorum! Yünlerim çok yumuşak, değil mi?")]
        case .findik: [String(localized: "Ooo, bu ne? Hadi gidip bakalım!"),
                       String(localized: "Fındık buldum! Seninle paylaşayım mı?")]
        case .lodos: [String(localized: "Vuuuu! Rüzgâr beni gıdıklıyor!"),
                      String(localized: "Tut beni, yoksa bulutlara uçacağım!")]
        case .nur: [String(localized: "Hu hu… Gel bakalım küçük dostum, sana bir masal anlatayım."),
                    String(localized: "Gözlüklerim nerede? Ha, burnumun üstündeymiş!")]
        case .yildiz: [String(localized: "Pırıl pırıl! Gökyüzünden sana el sallıyorum."),
                       String(localized: "Bu gece hangi rüyaya uçalım?")]
        case .kaptanMidye: [String(localized: "Ahoy, miço! Fenerin ışığı yanıyor."),
                            String(localized: "Bıyıklarım deniz kokuyor, ha ha!")]
        }
    }
}

/// Karakter: duygu durumu + boşta animasyonu (nefes/süzülme + göz kırpma) + dokunma tepkisi (zıplama, ses, titreşim).
struct CharacterView: View {
    let character: CharacterID
    var mood: CharacterMood = .happy
    var size: CGFloat = 160
    var isInteractive = true
    /// Dokunulunca sesli tepki verilsin mi? (Galeride/Preview'da kapatılabilir)
    var speaksOnTap = true
    /// Giydirilmiş kıyafet (yalnızca bu karaktere aitse çizilir).
    var outfit: Outfit? = nil

    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathing = false
    @State private var blink = false
    @State private var bounce = false
    @State private var lineIndex = 0
    @State private var reactionMood: CharacterMood?

    var body: some View {
        art
            .scaleEffect(x: breathing ? 1.02 : 1, y: breathing ? 0.98 : 1, anchor: .bottom)
            .offset(y: bounce ? -size * 0.12 : 0)
            .rotationEffect(.degrees(bounce ? -4 : 0))
            .frame(width: size, height: size)
            .contentShape(Rectangle())
            .onTapGesture { if isInteractive { react() } }
            .onAppear(perform: startIdle)
            .task { await blinkLoop() }
            .accessibilityElement()
            .accessibilityLabel(Text(character.displayName))
            .accessibilityAddTraits(isInteractive ? .isButton : [])
    }

    @ViewBuilder private var art: some View {
        let shownMood = reactionMood ?? mood
        let assetName = "\(character.assetPrefix)_\(shownMood.rawValue)"
        if UIImage(named: assetName) != nil {
            Image(assetName).resizable().scaledToFit()
        } else {
            CharacterArt(character: character, mood: shownMood, blink: blink, mode: theme.mode, outfit: outfit)
                .scaleEffect(size / 200)
                .frame(width: size, height: size)
        }
    }

    private func startIdle() {
        guard let anim = Motion.idle(theme.mode, reduceMotion: reduceMotion) else { return }
        withAnimation(anim) { breathing = true }
    }

    private func blinkLoop() async {
        guard !reduceMotion else { return }
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(Double.random(in: 2.5...5)))
            blink = true
            try? await Task.sleep(for: .milliseconds(140))
            blink = false
        }
    }

    private func react() {
        Feedback.tap()
        if speaksOnTap {
            VoicePrompter.shared.speak(character.reactionLines[lineIndex % character.reactionLines.count])
            lineIndex += 1
        }
        reactionMood = .surprised
        let anim = reduceMotion ? Motion.reduced : Motion.standard(theme.mode, reduceMotion: false)
        withAnimation(anim) { bounce = true }
        Task {
            try? await Task.sleep(for: .milliseconds(260))
            withAnimation(anim) { bounce = false }
            try? await Task.sleep(for: .milliseconds(500))
            reactionMood = nil
        }
    }
}

#Preview("Karakterler — Gündüz") {
    ScrollView {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: 16) {
            ForEach(CharacterID.allCases) { c in
                VStack {
                    CharacterView(character: c, size: 130, speaksOnTap: false)
                    Text(c.displayName).masalFont(.bodyBold)
                }
            }
        }
        .padding()
    }
    .background(Palette.cream)
    .themed(.day)
}

#Preview("Pamuk — 3 duygu") {
    HStack {
        ForEach(CharacterMood.allCases, id: \.self) { m in
            CharacterView(character: .pamuk, mood: m, size: 110, isInteractive: false)
        }
    }
    .padding()
    .background(Palette.nightSky)
    .themed(.night)
}
