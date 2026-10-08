import SwiftUI

/// Çıkartma kataloğu. Gerçek görseller `sticker_<key>` asset'leriyle gelecek; şimdilik emoji + renk.
enum StickerCatalog {
    struct Item: Sendable { let key: String; let emoji: String; let color: AccentColor }
    static let all: [Item] = [
        .init(key: "moon", emoji: "🌙", color: .grape),
        .init(key: "star", emoji: "⭐️", color: .sun),
        .init(key: "acorn", emoji: "🌰", color: .orange),
        .init(key: "shell", emoji: "🐚", color: .sky),
        .init(key: "flower", emoji: "🌷", color: .berry),
        .init(key: "leaf", emoji: "🍃", color: .grass),
        .init(key: "lantern", emoji: "🏮", color: .orange),
        .init(key: "kite", emoji: "🪁", color: .berry),
    ]
    static func item(_ key: String) -> Item { all.first { $0.key == key } ?? all[0] }
}

/// Yuvarlak, beyaz kenarlı, hafif eğik çıkartma. Kazanılmamışsa soluk silüet ("henüz") gösterilir.
struct StickerView: View {
    let key: String
    var isEarned = true
    var size: CGFloat = 84

    @Environment(\.theme) private var theme

    var body: some View {
        let item = StickerCatalog.item(key)
        ZStack {
            Circle().fill(Color.white)
            Circle().fill(item.color.color(for: theme.mode)).padding(size * 0.07)
            Text(item.emoji).font(.system(size: size * 0.46))
                .saturation(isEarned ? 1 : 0)
                .opacity(isEarned ? 1 : 0.35)
        }
        .overlay(Circle().strokeBorder(theme.outline, lineWidth: Metrics.outlineWidth))
        .frame(width: size, height: size)
        .rotationEffect(.degrees(Double((key.unicodeScalars.first?.value ?? 0) % 13) - 6))
        .opacity(isEarned ? 1 : 0.55)
        .shadow(color: .black.opacity(0.12), radius: 0, x: 0, y: 4)
        .accessibilityLabel(Text(isEarned ? "Çıkartma" : "Henüz kazanılmadı"))
    }
}

#Preview("StickerView") {
    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 16) {
        ForEach(Array(StickerCatalog.all.enumerated()), id: \.offset) { i, s in
            StickerView(key: s.key, isEarned: i < 5)
        }
    }
    .padding()
    .background(Palette.cream)
    .themed(.day)
}
