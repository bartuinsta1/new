import Foundation

/// Bölgelerin açılma kuralı (§2.3: kilitli bölgeler bulutla kaplı, çocuk dinledikçe açılır).
///
/// VARSAYIM: Uyku Evi, Fısıltı Ormanı, Masalcı Çınarı ve Hazine Sandığı baştan açık.
/// Yıldız Tepesi 1, Deniz Feneri Koyu 2, Duygu Bahçesi 3 dinlenen masaldan sonra uyanır.
/// Ebeveyn onboarding'de bir "değer/gündem" seçtiyse Duygu Bahçesi baştan açıktır — o masallar ona lazım.
/// Bu kural ücretli içerikten bağımsızdır: ücretli masallar açık bölgelerde "uyuyan kart" olarak görünür.
enum RegionUnlocks {
    static func requiredStories(for region: Region) -> Int {
        switch region {
        case .sleepHouse, .whisperForest, .storytellerPlane, .treasureChest: 0
        case .starHill: 1
        case .lighthouseCove: 2
        case .feelingsGarden: 3
        }
    }

    static func isUnlocked(_ region: Region, listenedStories: Int, hasValueTopics: Bool = false) -> Bool {
        if region == .feelingsGarden && hasValueTopics { return true }
        return listenedStories >= requiredStories(for: region)
    }
}

/// Uyku saatine yaklaşınca Uyku Evi'nin penceresi parlar ve Pamuk "Uyku zamanı geldi!" der (§3.2).
enum BedtimeNudge {
    /// Uyku saatinden 30 dk önce başlar, 2 saat sonrasına kadar sürer.
    static let leadMinutes = 30
    static let tailMinutes = 120

    static func isNear(_ date: Date, bedtime: Bedtime, calendar: Calendar = .current) -> Bool {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        let now = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        let bed = bedtime.hour * 60 + bedtime.minute
        // Gece yarısını aşan aralık için gün başına sarma.
        var diff = now - bed
        if diff < -12 * 60 { diff += 24 * 60 }
        if diff > 12 * 60 { diff -= 24 * 60 }
        return diff >= -leadMinutes && diff <= tailMinutes
    }
}

extension ChildProfile {
    /// En az bir kez dinlenen masal sayısı (kişisel + kütüphane).
    var listenedStoryCount: Int { stories.filter { $0.playCount > 0 }.count }
}
