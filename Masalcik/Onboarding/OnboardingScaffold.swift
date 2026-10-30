import SwiftUI

/// Onboarding adımlarının ortak iskeleti: üstte geri + ilerleme noktaları, ortada içerik, altta ana düğme.
struct OnboardingScaffold<Content: View>: View {
    let step: OnboardingModel.Step
    var primaryTitle: LocalizedStringKey = "Devam"
    var primaryIcon: String = "arrow.right"
    var canContinue = true
    var showsBack = true
    var secondaryTitle: LocalizedStringKey? = nil
    var onPrimary: () -> Void
    var onBack: () -> Void = {}
    var onSecondary: () -> Void = {}
    @ViewBuilder var content: () -> Content

    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                if showsBack {
                    BubbleButton(systemImage: "chevron.left", color: .sky, accessibilityLabel: "Geri", action: onBack)
                } else {
                    Color.clear.frame(width: Metrics.minTapTarget, height: Metrics.minTapTarget)
                }
                Spacer()
                StepDots(current: step.visibleIndex, total: OnboardingModel.visibleStepCount)
                Spacer()
                Color.clear.frame(width: Metrics.minTapTarget, height: Metrics.minTapTarget)
            }
            .padding(.horizontal, Metrics.spacingM)
            .padding(.top, Metrics.spacingS)

            ScrollView {
                content()
                    .frame(maxWidth: 640)
                    .padding(.horizontal, Metrics.spacingM)
                    .padding(.vertical, Metrics.spacingM)
                    .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)

            VStack(spacing: Metrics.spacingS) {
                BubbleButton(primaryTitle, systemImage: primaryIcon, color: canContinue ? .grass : .sky, size: .large,
                             action: onPrimary)
                    .disabled(!canContinue)
                    .opacity(canContinue ? 1 : 0.5)
                    .accessibilityIdentifier("onboarding.primary")
                if let secondaryTitle {
                    Button(action: onSecondary) {
                        Text(secondaryTitle).masalFont(.bodyBold).underline()
                            .foregroundStyle(theme.secondaryInk)
                            .frame(minHeight: 44)
                    }
                }
            }
            .padding(.bottom, Metrics.spacingM)
        }
        .background(theme.background.ignoresSafeArea())
    }
}

/// 1…6 ilerleme noktaları (metin yok; çocuk için görsel).
struct StepDots: View {
    let current: Int
    let total: Int
    @Environment(\.theme) private var theme

    var body: some View {
        HStack(spacing: 8) {
            ForEach(1...total, id: \.self) { i in
                Capsule()
                    .fill(i <= current ? theme.primary.color(for: theme.mode) : theme.surface)
                    .overlay(Capsule().strokeBorder(theme.outline, lineWidth: 2))
                    .frame(width: i == current ? 28 : 14, height: 14)
            }
        }
        .animation(Motion.daySpring, value: current)
        .frame(minHeight: Metrics.minTapTarget)   // yanındaki düğmelerle aynı satır yüksekliği; erişilebilirlik çerçevesi de büyür
        .accessibilityElement()
        .accessibilityAddTraits(.isStaticText)
        .accessibilityLabel(Text("Adım \(current) / \(total)"))
    }
}

/// Ebeveyn adımlarında başlık + açıklama.
struct OnboardingHeader: View {
    let title: LocalizedStringKey
    var subtitle: LocalizedStringKey? = nil
    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: Metrics.spacingS) {
            Text(title).masalFont(.title).multilineTextAlignment(.center)
                .foregroundStyle(theme.ink)
                .accessibilityAddTraits(.isHeader)
            if let subtitle {
                Text(subtitle).masalFont(.body).multilineTextAlignment(.center)
                    .foregroundStyle(theme.secondaryInk)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// Seçilebilir yuvarlak kabarcık (ilgi alanı, değer, yaş).
struct ChoiceBubble: View {
    let emoji: String?
    let title: String
    let isSelected: Bool
    var color: AccentColor = .sun
    var size: CGFloat = 104
    let action: () -> Void

    @Environment(\.theme) private var theme

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                if let emoji { Text(emoji).font(.system(size: size * 0.36)) }
                Text(title).masalFont(.caption, scales: false).lineLimit(2).minimumScaleFactor(0.75)
                    .multilineTextAlignment(.center)
            }
            .padding(6)
            .frame(width: size, height: size)
            .overlay(alignment: .topTrailing) {
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 26, weight: .heavy))
                        .foregroundStyle(Palette.grass, Palette.ink)
                        .background(Circle().fill(.white))
                        .offset(x: 4, y: -4)
                }
            }
        }
        .buttonStyle(BubbleButtonStyle(color: isSelected ? color : .sky, shape: .circle))
        .saturation(isSelected ? 1 : 0.35)
        .accessibilityLabel(Text(title))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
