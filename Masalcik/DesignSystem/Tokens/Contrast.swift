import SwiftUI
import UIKit

/// WCAG 2.1 kontrast oranı. Tasarım belirteçlerinin okunabilirliğini testlerde sabitlemek için.
/// AA: normal metin ≥ 4,5 · büyük metin (≥ 18 pt ya da ≥ 14 pt kalın) ve simgeler ≥ 3.
enum Contrast {
    static let normalText = 4.5
    static let largeText = 3.0

    /// `foreground` yarı saydamsa `background` üstüne karıştırılarak hesaplanır.
    static func ratio(_ foreground: Color, on background: Color) -> Double {
        let bg = components(background)
        var fg = components(foreground)
        let a = fg.a
        fg = (fg.r * a + bg.r * (1 - a), fg.g * a + bg.g * (1 - a), fg.b * a + bg.b * (1 - a), 1)
        let l1 = luminance(fg), l2 = luminance(bg)
        return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
    }

    private static func components(_ color: Color) -> (r: Double, g: Double, b: Double, a: Double) {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a)
        return (Double(r), Double(g), Double(b), Double(a))
    }

    private static func luminance(_ c: (r: Double, g: Double, b: Double, a: Double)) -> Double {
        func lin(_ v: Double) -> Double { v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
    }
}
