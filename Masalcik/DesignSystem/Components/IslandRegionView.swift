import SwiftUI

/// Haritadaki bir bölge: yuvarlak ada parçası + simge + rehber karakter.
/// Kilitliyse uyuyan bulutla örtülür; dokunulunca kilitli bölge bile nazik bir tepki verir (bulut esner).
struct IslandRegionView: View {
    let region: Region
    var isLocked = false
    var isHighlighted = false
    var size: CGFloat = 150
    var action: () -> Void = {}

    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var floating = false
    @State private var pressed = false

    var body: some View {
        let base = region.accent.color(for: theme.mode)
        Button {
            action()
        } label: {
            ZStack {
                // Ada tabanı (2.5D: alt kenarda koyu şerit)
                Ellipse().fill(base.darkened(0.25))
                    .frame(width: size, height: size * 0.62)
                    .offset(y: size * 0.1)
                Ellipse().fill(base)
                    .overlay(Ellipse().strokeBorder(theme.outline, lineWidth: Metrics.outlineWidth))
                    .frame(width: size, height: size * 0.62)
                if isHighlighted {
                    Ellipse().fill(theme.glow.opacity(0.35)).blur(radius: 14)
                        .frame(width: size * 1.1, height: size * 0.7)
                }
                // Simge rozeti
                Image(systemName: region.symbol)
                    .font(.system(size: size * 0.2, weight: .heavy))
                    .foregroundStyle(Palette.ink)
                    .frame(width: size * 0.36, height: size * 0.36)
                    .background(Circle().fill(theme.mode == .day ? Color.white : Palette.moon))
                    .overlay(Circle().strokeBorder(theme.outline, lineWidth: Metrics.outlineWidth))
                    .offset(y: -size * 0.22)
                if !isLocked {
                    CharacterView(character: region.guide, mood: theme.mode == .night ? .sleepy : .happy,
                                  size: size * 0.42, isInteractive: false)
                        .offset(x: size * 0.34, y: 0)
                }
                if isLocked {
                    CloudLock(size: size * 0.95)
                        .offset(y: -size * 0.05)
                }
            }
            .frame(width: size * 1.1, height: size * 0.95)
            .offset(y: floating ? -4 : 0)
        }
        .buttonStyle(RegionPressStyle())
        .accessibilityLabel(Text(region.title))
        .accessibilityValue(isLocked ? Text("Henüz uyuyor") : Text(""))
        .onAppear {
            guard let anim = Motion.idle(theme.mode, reduceMotion: reduceMotion) else { return }
            withAnimation(anim.delay(Double(region.title.count % 5) * 0.2)) { floating = true }
        }
    }
}

/// Bölgeye basınca hafif büzülme.
private struct RegionPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.94 : 1)
            .animation(reduceMotion ? nil : Motion.daySpring, value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, p in if p { Feedback.tap() } }
    }
}

/// Bölge adı etiketi (haritada bölgenin altında).
struct RegionLabel: View {
    let region: Region
    @Environment(\.theme) private var theme
    var body: some View {
        Text(region.title)
            .masalFont(.bodyBold, scales: false)
            .foregroundStyle(Palette.ink)
            .padding(.horizontal, 12).padding(.vertical, 4)
            .background(Capsule().fill(theme.mode == .day ? Color.white : Palette.moon))
            .overlay(Capsule().strokeBorder(theme.outline, lineWidth: 2))
    }
}

#Preview("IslandRegionView") {
    HStack(spacing: 8) {
        VStack { IslandRegionView(region: .whisperForest); RegionLabel(region: .whisperForest) }
        VStack { IslandRegionView(region: .starHill, isLocked: true); RegionLabel(region: .starHill) }
    }
    .padding()
    .background(Palette.sky.opacity(0.4))
    .themed(.day)
}
