import Foundation

/// Uygulamanın desteklediği diller. Arayüz ve masal içeriği aynı dili kullanır.
///
/// VARSAYIM: Dil seçimi iOS'un uygulama başına dil ayarıyla yapılır (Ayarlar › Masalcık › Dil).
/// Uygulama iki yerelleştirme içerdiği için iOS bu seçeneği otomatik gösterir; Ebeveyn Köşesi'ndeki
/// "Dil" satırı bu ayara götürür (Adım 9). Böylece tarih, sayı ve VoiceOver dili de tutarlı kalır.
enum AppLanguage: String, Codable, CaseIterable, Identifiable, Sendable {
    case tr, en

    var id: String { rawValue }

    /// Uygulamanın şu an çalıştığı dil (iOS'un seçtiği yerelleştirme).
    static var current: AppLanguage {
        let preferred = Bundle.main.preferredLocalizations.first ?? "tr"
        return preferred.hasPrefix("en") ? .en : .tr
    }

    var locale: Locale { Locale(identifier: self == .tr ? "tr_TR" : "en_US") }

    /// Cihaz içi konuşma sentezi ve TTS için BCP-47 dil kodu.
    var speechCode: String { self == .tr ? "tr-TR" : "en-US" }

    /// Bu dilin derlenmiş metinlerini içeren paket (`tr.lproj` / `en.lproj`).
    /// Arayüz dilinden bağımsız olarak belirli bir dilde metin üretmek için (masal anlatımı, testler).
    var bundle: Bundle {
        Bundle.main.path(forResource: rawValue, ofType: "lproj").flatMap(Bundle.init(path:)) ?? .main
    }

    /// Dilin kendi adıyla gösterimi (dil seçicide çeviri yapılmaz).
    var nativeName: String { self == .tr ? "Türkçe" : "English" }
}

/// İngilizce yardımcıları (TurkishText'in karşılığı).
enum EnglishText {
    private static let ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
                               "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
                               "seventeen", "eighteen", "nineteen"]
    private static let tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

    /// 0…999: 63 → "sixty-three", 115 → "one hundred fifteen".
    static func numberWords(_ n: Int) -> String {
        precondition((0...999).contains(n), "Only 0…999 supported")
        if n == 0 { return "zero" }
        var parts: [String] = []
        let h = n / 100, rest = n % 100
        if h > 0 { parts.append("\(ones[h]) hundred") }
        if rest > 0 {
            if rest < 20 { parts.append(ones[rest]) }
            else { parts.append(rest % 10 == 0 ? tens[rest / 10] : "\(tens[rest / 10])-\(ones[rest % 10])") }
        }
        return parts.joined(separator: " ")
    }
}

/// Dile göre sayı okunuşu.
extension AppLanguage {
    func numberWords(_ n: Int) -> String {
        self == .tr ? TurkishText.numberWords(n) : EnglishText.numberWords(n)
    }
}
