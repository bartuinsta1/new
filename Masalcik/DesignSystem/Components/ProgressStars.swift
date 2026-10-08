import SwiftUI

/// İlerleme yıldızları (ör. haftalık masal serisi: 7 yıldız). Boş yıldız ceza değil, sadece "henüz" demektir (§3.6).
struct ProgressStars: View {
    let filled: Int
    var total: Int = 7
    var starSize: CGFloat = 32

    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: starSize * 0.15) {
            ForEach(0..<total, id: \.self) { i in
                let on = i < filled
                RoundedStar()
                    .fill(on ? (theme.mode == .day ? Palette.sun : Palette.firefly) : theme.surface.opacity(0.6))
                    .overlay(RoundedStar().stroke(theme.outline, style: StrokeStyle(lineWidth: 2.5, lineJoin: .round)))
                    .frame(width: starSize, height: starSize)
                    .scaleEffect(on ? 1 : 0.85)
                    .shadow(color: on && theme.mode == .night ? Palette.firefly.opacity(0.6) : .clear, radius: 6)
                    .animation(Motion.standard(theme.mode, reduceMotion: reduceMotion).delay(Double(i) * 0.05), value: filled)
            }
        }
        .accessibilityElement()
        .accessibilityLabel(Text("\(filled) / \(total) yıldız"))
    }
}

#Preview("ProgressStars") {
    VStack(spacing: 24) {
        ProgressStars(filled: 4).padding().background(Palette.cream).themed(.day)
        ProgressStars(filled: 6).padding().background(Palette.nightSky).themed(.night)
    }
}
