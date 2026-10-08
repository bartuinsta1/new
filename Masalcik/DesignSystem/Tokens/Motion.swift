import SwiftUI

/// Hareket tokenları (§2.6).
/// Gündüz: zıplayan spring. Gece: yavaş easeInOut. "Hareketi Azalt" açıkken zıplama yok, kısa bir geçiş var.
enum Motion {
    static let daySpring = Animation.spring(response: 0.4, dampingFraction: 0.6)
    static let nightEase = Animation.easeInOut(duration: 1.5)
    static let reduced = Animation.easeInOut(duration: 0.2)

    /// Durum değişimleri için (basma, açılma, seçim).
    static func standard(_ mode: DisplayMode, reduceMotion: Bool) -> Animation {
        if reduceMotion { return reduced }
        return mode == .day ? daySpring : nightEase
    }

    /// Sürekli boşta animasyonları (nefes alma, süzülme). Hareketi Azalt açıkken `nil` → animasyon yok.
    static func idle(_ mode: DisplayMode, reduceMotion: Bool) -> Animation? {
        if reduceMotion { return nil }
        return mode == .day
            ? .easeInOut(duration: 1.2).repeatForever(autoreverses: true)
            : .easeInOut(duration: 2.4).repeatForever(autoreverses: true)
    }
}
