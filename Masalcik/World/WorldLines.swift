import Foundation

/// Haritadaki sesli yönergeler ve rehber replikleri (§2.1, §3.2). Her biri String Catalog'da TR + EN.
/// Bölge adları cümle içinde çekim ekiyle geçtiği için ("Fısıltı Ormanı'nda") cümleler bölge başına ayrı yazıldı.
enum WorldLines {
    static var mapHint: String { String(localized: "Masal seçmek için adada bir yere dokun!") }
    static var bedtime: String { String(localized: "Uyku zamanı geldi! Uyku Evi'ne gidelim mi?") }
    static var regionSleeping: String { String(localized: "Bu bölge henüz uyuyor. Masal dinledikçe uyanacak!") }
    /// Ücretli masala dokunulunca: satın almaya yönlendirmez (§2.3).
    static var storySleeping: String { String(localized: "Bu masal şimdilik uyuyor. Başka bir masal seçelim mi?") }

    static func intro(for region: Region) -> String {
        switch region {
        case .sleepHouse: String(localized: "Uyku Evi'ne hoş geldin! Bu gecenin masalı için kapıya dokun.")
        case .whisperForest: String(localized: "Fısıltı Ormanı'nda hayvan dostlarımız seni bekliyor! Bir masal seç.")
        case .starHill: String(localized: "Yıldız Tepesi'ne hoş geldin! Hangi yıldıza uçalım?")
        case .lighthouseCove: String(localized: "Ahoy! Deniz Feneri Koyu'nda masallar dalgalarla gelir.")
        case .storytellerPlane: String(localized: "Hu hu… Masalcı Çınarı'nın gölgesine otur, sana eski bir masal anlatayım.")
        case .feelingsGarden: String(localized: "Duygu Bahçesi'nde her çiçek bir duygu! Hangisini dinleyelim?")
        case .treasureChest: String(localized: "Hazine Sandığı'nda kazandığın çıkartmalar duruyor!")
        }
    }
}
