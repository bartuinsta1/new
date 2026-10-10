import SwiftUI

/// Ebeveyn kapısı sorusu (§3.8): sayı yazıyla verilir, rakamla girilir.
/// Okuma yazma bilen bir yetişkin kolayca çözer; okuma bilmeyen küçük çocuk çözemez.
struct ParentGateChallenge: Equatable, Sendable {
    let answer: Int
    var language: AppLanguage = .current

    var words: String { language.numberWords(answer) }

    /// tr: "Altmış üç rakamla yazılırsa hangisi?" · en: "What is sixty-three written in digits?"
    var prompt: String {
        // Türkçede soru sayıyla başladığı için ilk harf büyütülür; İngilizcede sayı cümle ortasındadır.
        let shown = language == .tr ? capitalizedTurkish(words) : words
        return String(localized: "\(shown) rakamla yazılırsa hangisi?", bundle: language.bundle)
    }

    private func capitalizedTurkish(_ s: String) -> String {
        guard let first = s.first else { return s }
        return TurkishText.uppercased(String(first)) + s.dropFirst()
    }

    /// 21…99 arası, sonu 0 olmayan iki basamaklı sayılar (tek kelimelik "elli" gibi kolay sayılardan kaçınılır).
    static func random<G: RandomNumberGenerator>(using rng: inout G, language: AppLanguage = .current) -> ParentGateChallenge {
        var n: Int
        repeat { n = Int.random(in: 21...99, using: &rng) } while n % 10 == 0
        return ParentGateChallenge(answer: n, language: language)
    }

    static func random(language: AppLanguage = .current) -> ParentGateChallenge {
        var g = SystemRandomNumberGenerator()
        return random(using: &g, language: language)
    }

    func isCorrect(_ input: String) -> Bool { Int(input) == answer }
}

/// Kapının mantığı: giriş, deneme sayısı, kısa bekleme.
@MainActor
@Observable
final class ParentGateModel {
    private(set) var challenge: ParentGateChallenge
    private(set) var input = ""
    private(set) var failedAttempts = 0
    private(set) var isUnlocked = false
    private(set) var shakeTrigger = 0
    @ObservationIgnored private let makeChallenge: () -> ParentGateChallenge

    init(makeChallenge: @escaping () -> ParentGateChallenge = { .random() }) {
        self.makeChallenge = makeChallenge
        self.challenge = makeChallenge()
    }

    var digitsNeeded: Int { String(challenge.answer).count }

    func type(_ digit: Int) {
        guard !isUnlocked, input.count < digitsNeeded else { return }
        input.append(String(digit))
        if input.count == digitsNeeded { submit() }
    }

    func deleteLast() {
        guard !input.isEmpty else { return }
        input.removeLast()
    }

    private func submit() {
        if challenge.isCorrect(input) {
            isUnlocked = true
        } else {
            failedAttempts += 1
            shakeTrigger += 1
            input = ""
            // Her yanlışta yeni soru: deneme-yanılmayla tahmin edilmesin.
            challenge = makeChallenge()
        }
    }
}

/// Ebeveyn kapısı ekranı. Satın alma, dış link, ayarlar ve paylaşım hep bunun arkasında.
struct ParentGate: View {
    var onUnlock: () -> Void
    var onCancel: () -> Void

    @State private var model = ParentGateModel()
    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: Metrics.spacingL) {
            HStack {
                Spacer()
                Button(action: onCancel) {
                    Image(systemName: "xmark").font(.system(size: 20, weight: .heavy))
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(BubbleButtonStyle(color: .sky, shape: .circle))
                .accessibilityLabel(Text("Kapat"))
            }
            Text("Ebeveyn Köşesi")
                .masalFont(.title)
                .foregroundStyle(theme.ink)
            Text("Devam etmek için bir yetişkinin yanıtlaması gerekiyor.")
                .masalFont(.body)
                .foregroundStyle(theme.secondaryInk)
                .multilineTextAlignment(.center)
            Text(model.challenge.prompt)
                .masalFont(.headline)
                .foregroundStyle(theme.ink)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)

            // Girilen rakamlar
            HStack(spacing: Metrics.spacingS) {
                ForEach(0..<model.digitsNeeded, id: \.self) { i in
                    let chars = Array(model.input)
                    Text(i < chars.count ? String(chars[i]) : " ")
                        .masalFont(.title)
                        .frame(width: 56, height: 64)
                        .background(RoundedRectangle(cornerRadius: 16).fill(theme.surface))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(theme.outline, lineWidth: Metrics.outlineWidth))
                }
            }
            .modifier(ShakeEffect(animatableData: CGFloat(model.shakeTrigger)))
            .animation(.default, value: model.shakeTrigger)
            .accessibilityElement()
            .accessibilityLabel(Text("Girilen: \(model.input)"))

            keypad
        }
        .padding(Metrics.spacingL)
        .frame(maxWidth: 420)
        .onChange(of: model.isUnlocked) { _, unlocked in
            if unlocked { Feedback.success(); onUnlock() }
        }
        .onChange(of: model.shakeTrigger) { _, _ in Feedback.error() }
    }

    private var keypad: some View {
        let rows: [[Int?]] = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [nil, 0, -1]]
        return VStack(spacing: Metrics.spacingS) {
            ForEach(0..<rows.count, id: \.self) { r in
                HStack(spacing: Metrics.spacingS) {
                    ForEach(0..<3, id: \.self) { c in
                        keyView(rows[r][c])
                    }
                }
            }
        }
    }

    @ViewBuilder private func keyView(_ key: Int?) -> some View {
        switch key {
        case .none:
            Color.clear.frame(width: 76, height: 64)
        case .some(-1):
            Button { model.deleteLast() } label: {
                Image(systemName: "delete.left.fill").font(.system(size: 22, weight: .bold))
                    .frame(width: 76, height: 58)
            }
            .buttonStyle(BubbleButtonStyle(color: .berry))
            .accessibilityLabel(Text("Sil"))
        case .some(let d):
            Button { model.type(d) } label: {
                Text(verbatim: "\(d)").masalFont(.title, scales: false)
                    .frame(width: 76, height: 58)
            }
            .buttonStyle(BubbleButtonStyle(color: .sun))
        }
    }
}

/// Yanlış yanıtta yatay sallanma.
struct ShakeEffect: GeometryEffect {
    var animatableData: CGFloat
    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 10 * sin(animatableData * .pi * 4), y: 0))
    }
}

#Preview("ParentGate") {
    ParentGate(onUnlock: {}, onCancel: {})
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.cream)
        .themed(.day)
}
