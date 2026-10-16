import SwiftUI
import UIKit

// MARK: - Renk tokenları (şartname §2.6)

extension Color {
    /// "#RRGGBB" ya da "RRGGBB"
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(.sRGB,
                  red: Double((v >> 16) & 0xFF) / 255,
                  green: Double((v >> 8) & 0xFF) / 255,
                  blue: Double(v & 0xFF) / 255,
                  opacity: 1)
    }

    /// HSB parlaklığını oranla düşürür. `darkened(0.2)` → %20 koyu (buton alt gölgesi).
    func darkened(_ amount: Double = 0.2) -> Color {
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return Color(hue: h, saturation: s, brightness: b * (1 - amount), opacity: a)
    }

    /// Doygunluğu oranla düşürür. Gece modu için `desaturated(0.4)`.
    func desaturated(_ amount: Double) -> Color {
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return Color(hue: h, saturation: s * (1 - amount), brightness: b * (1 - amount * 0.35), opacity: a)
    }
}

/// Ham palet. Ekranlarda doğrudan bunlar yerine `Theme` rollerini kullanın.
enum Palette {
    // Gündüz
    static let sky = Color(hex: "#5BC8F5")
    static let grass = Color(hex: "#7ED957")
    static let sun = Color(hex: "#FFC93C")
    static let berry = Color(hex: "#FF6B8B")
    static let grape = Color(hex: "#8B6CEF")
    static let orange = Color(hex: "#FF9F43")
    static let ink = Color(hex: "#2B2D42")
    static let cream = Color(hex: "#FFF8EC")
    static let white = Color.white

    // Gece
    static let nightSky = Color(hex: "#1E1B4B")
    static let dusk = Color(hex: "#3B2F6B")
    static let moon = Color(hex: "#FFE8A3")
    static let firefly = Color(hex: "#FFD166")
    static let nightInk = Color(hex: "#E8E6FF")
    /// Gece modunda renkli dolguların (buton, rozet) üstündeki metin. Açık metin %40 soluk dolgularda okunmuyordu
    /// (WCAG kontrast 1,5–2,5); koyu lacivertle 6–10 (bkz. AccessibilityTests).
    static let nightOnAccent = Color(hex: "#14112F")
    /// Beyaz/krem zeminde mor metin ve bağlantı rengi. `grape` metin için 3,8 kontrastta kalıyordu; bu ton 5,9.
    static let grapeText = Color(hex: "#6A4BD6")
}

/// Mod bağımsız bir "vurgu" rengi. Gece modunda otomatik olarak %40 doygunluk kaybeder.
enum AccentColor: String, CaseIterable, Sendable {
    case sky, grass, sun, berry, grape, orange

    var day: Color {
        switch self {
        case .sky: Palette.sky
        case .grass: Palette.grass
        case .sun: Palette.sun
        case .berry: Palette.berry
        case .grape: Palette.grape
        case .orange: Palette.orange
        }
    }

    func color(for mode: DisplayMode) -> Color {
        mode == .day ? day : day.desaturated(0.4)
    }

    /// Buton alt gölge şeridi: %20 koyulaştırılmış ton.
    func shadow(for mode: DisplayMode) -> Color { color(for: mode).darkened(0.2) }
}

/// Avatar renk seçenekleri (§2.5).
enum AvatarPalette {
    static let skin: [Color] = ["#FFE0C7", "#F6CBA5", "#E0A77F", "#C68660", "#9A6544", "#6B4430"].map(Color.init(hex:))
    static let hair: [Color] = ["#2B2D42", "#6B4226", "#A0522D", "#E3B04B", "#D9653B", "#8B6CEF"].map(Color.init(hex:))
    static let pajama: [Color] = [Palette.sky, Palette.berry, Palette.grass, Palette.sun, Palette.grape, Palette.orange]
}

extension Region {
    /// Bölgenin harita ve kapak rengi.
    var accent: AccentColor {
        switch self {
        case .sleepHouse: .sun
        case .whisperForest: .grass
        case .starHill: .grape
        case .lighthouseCove: .sky
        case .storytellerPlane: .orange
        case .feelingsGarden: .berry
        case .treasureChest: .sun
        }
    }

    /// Yer tutucu simge (gerçek illüstrasyonlar gelene kadar).
    var symbol: String {
        switch self {
        case .sleepHouse: "house.fill"
        case .whisperForest: "tree.fill"
        case .starHill: "moon.stars.fill"
        case .lighthouseCove: "light.beacon.max.fill"
        case .storytellerPlane: "book.fill"
        case .feelingsGarden: "heart.fill"
        case .treasureChest: "shippingbox.fill"
        }
    }
}
