import SwiftUI

/// Tipografi tokenları (§2.6). Fontlar pakete gömülüdür (Resources/Fonts, Info.plist → UIAppFonts).
/// Başlık: Baloo 2 ExtraBold · Gövde: Nunito SemiBold/Bold. Türkçe karakter kapsamı doğrulandı (ç ğ ı İ ö ş ü).
enum MasalFont {
    static let display = "Baloo2-ExtraBold"
    static let bodySemibold = "Nunito-SemiBold"
    static let bodyBold = "Nunito-Bold"
}

enum TextToken {
    case display    // 40 — karşılama, büyük başlıklar
    case title      // 28 — ekran başlığı
    case headline   // 22 — kart başlığı
    case body       // 17
    case bodyBold   // 17
    case caption    // 14 — rozetler

    var size: CGFloat {
        switch self {
        case .display: 40
        case .title: 28
        case .headline: 22
        case .body, .bodyBold: 17
        case .caption: 14
        }
    }

    var fontName: String {
        switch self {
        case .display, .title, .headline: MasalFont.display
        case .body: MasalFont.bodySemibold
        case .bodyBold, .caption: MasalFont.bodyBold
        }
    }

    var relativeTo: Font.TextStyle {
        switch self {
        case .display: .largeTitle
        case .title: .title
        case .headline: .title3
        case .body, .bodyBold: .body
        case .caption: .caption
        }
    }

    /// Dynamic Type ile ölçeklenen font (ebeveyn tarafı).
    var font: Font { .custom(fontName, size: size, relativeTo: relativeTo) }

    /// Sabit boyutlu font (çocuk tarafı: yerleşim büyük ve görsel, metin zaten minimum).
    var fixedFont: Font { .custom(fontName, fixedSize: size) }
}

extension View {
    /// `Text("…").masalFont(.title)`
    func masalFont(_ token: TextToken, scales: Bool = true) -> some View {
        font(scales ? token.font : token.fixedFont)
    }
}
