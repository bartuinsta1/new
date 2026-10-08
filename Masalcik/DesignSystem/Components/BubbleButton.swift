import SwiftUI

/// "Basılabilir düğme" stili: kalın dış çizgi + alt kenarda koyu gölge şeridi.
/// Basılınca gölge şeridi kaybolur ve düğme içeri girer (§2.6, §2.7).
struct BubbleButtonStyle: ButtonStyle {
    var color: AccentColor = .sun
    var shape: BubbleShape = .rounded
    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    enum BubbleShape { case rounded, circle }

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        let depth = pressed ? 0 : Metrics.pressDepth
        let fill = color.color(for: theme.mode)
        let shadow = color.shadow(for: theme.mode)

        configuration.label
            .foregroundStyle(theme.mode == .day ? Palette.ink : Palette.nightInk)
            .background {
                shapeView(fill: fill)
            }
            .offset(y: pressed ? Metrics.pressDepth : 0)
            .background {
                // Alt gölge şeridi: aynı şekil, koyu ton, aşağı kaydırılmış.
                shapeView(fill: shadow)
                    .offset(y: Metrics.pressDepth)
            }
            .padding(.bottom, Metrics.pressDepth)
            .animation(reduceMotion ? nil : .spring(response: 0.18, dampingFraction: 0.7), value: depth)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { Feedback.tap() }
            }
    }

    @ViewBuilder
    private func shapeView(fill: Color) -> some View {
        switch shape {
        case .rounded:
            RoundedRectangle(cornerRadius: Metrics.buttonRadius, style: .continuous)
                .fill(fill)
                .overlay(RoundedRectangle(cornerRadius: Metrics.buttonRadius, style: .continuous)
                    .strokeBorder(theme.outline, lineWidth: Metrics.outlineWidth))
        case .circle:
            Circle()
                .fill(fill)
                .overlay(Circle().strokeBorder(theme.outline, lineWidth: Metrics.outlineWidth))
        }
    }
}

/// Hazır düğme: simge + isteğe bağlı etiket.
struct BubbleButton: View {
    enum Size {
        case regular, large
        var side: CGFloat { self == .regular ? Metrics.minTapTarget : Metrics.primaryTapTarget }
        var iconSize: CGFloat { self == .regular ? 26 : 40 }
    }

    var title: LocalizedStringKey?
    var systemImage: String?
    var color: AccentColor = .sun
    var size: Size = .regular
    /// Çocuk tarafında metin yerine görsel: VoiceOver için etiket zorunlu.
    var accessibilityLabel: LocalizedStringKey
    let action: () -> Void

    init(_ title: LocalizedStringKey? = nil, systemImage: String? = nil, color: AccentColor = .sun,
         size: Size = .regular, accessibilityLabel: LocalizedStringKey? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.color = color
        self.size = size
        self.accessibilityLabel = accessibilityLabel ?? title ?? ""
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Metrics.spacingS) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: size.iconSize, weight: .heavy))
                }
                if let title {
                    Text(title).masalFont(size == .large ? .title : .headline, scales: false)
                }
            }
            .padding(.horizontal, title == nil ? 0 : Metrics.spacingL)
            .frame(minWidth: size.side, minHeight: size.side)
        }
        .buttonStyle(BubbleButtonStyle(color: color, shape: title == nil ? .circle : .rounded))
        .accessibilityLabel(accessibilityLabel)
    }
}

#Preview("BubbleButton — Gündüz") {
    VStack(spacing: 24) {
        BubbleButton("Masalı Başlat", systemImage: "play.fill", color: .sun, size: .large) {}
        HStack(spacing: 16) {
            BubbleButton(systemImage: "star.fill", color: .grape, accessibilityLabel: "Yıldız") {}
            BubbleButton(systemImage: "heart.fill", color: .berry, accessibilityLabel: "Favori") {}
            BubbleButton(systemImage: "leaf.fill", color: .grass, accessibilityLabel: "Orman") {}
        }
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Palette.cream)
    .themed(.day)
}

#Preview("BubbleButton — Gece") {
    VStack(spacing: 24) {
        BubbleButton("Uyku Zamanı", systemImage: "moon.fill", color: .grape, size: .large) {}
        BubbleButton(systemImage: "pause.fill", color: .sky, size: .large, accessibilityLabel: "Duraklat") {}
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Palette.nightSky)
    .themed(.night)
}
