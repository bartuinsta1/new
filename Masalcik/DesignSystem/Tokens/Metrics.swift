import SwiftUI

/// Boyut tokenları (§2.6).
enum Metrics {
    /// Çocuk tarafı en küçük dokunma alanı.
    static let minTapTarget: CGFloat = 64
    /// Çocuk tarafı ana eylem butonu.
    static let primaryTapTarget: CGFloat = 96

    static let cardRadius: CGFloat = 28
    static let buttonRadius: CGFloat = 24
    static let outlineWidth: CGFloat = 3

    /// "Basılabilir düğme" alt gölge şeridinin yüksekliği.
    static let pressDepth: CGFloat = 6

    static let spacingXS: CGFloat = 4
    static let spacingS: CGFloat = 8
    static let spacingM: CGFloat = 16
    static let spacingL: CGFloat = 24
    static let spacingXL: CGFloat = 32
}
