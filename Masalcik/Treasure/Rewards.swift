import Foundation

/// Hazine Sandığı ödül kuralları (§3.6). Saf mantık; testli.
/// Oyunlaştırma nazik: kaçırılan gece için ceza ya da "seriyi kaybettin" mesajı YOK. Yalnızca kazanılanlar gösterilir.
enum RewardRules {
    /// Gece yarısından sonra (06:00'ya kadar) dinlenen masal önceki geceye sayılır.
    static let nightRolloverHours = 6

    static func nightKey(for date: Date, calendar: Calendar = .current) -> String {
        let shifted = date.addingTimeInterval(-TimeInterval(nightRolloverHours * 3600))
        let c = calendar.dateComponents([.year, .month, .day], from: shifted)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Bugün (ya da henüz dinlenmediyse dün) biten arka arkaya masal gecesi sayısı.
    /// Bu gece henüz masal dinlenmediyse seri "bozulmuş" sayılmaz; dün geceye kadar sayılır.
    static func consecutiveNights(nights: Set<String>, now: Date, calendar: Calendar = .current) -> Int {
        var day = now
        if !nights.contains(nightKey(for: day, calendar: calendar)) {
            day = calendar.date(byAdding: .day, value: -1, to: day) ?? day
        }
        var count = 0
        while nights.contains(nightKey(for: day, calendar: calendar)) {
            count += 1
            day = calendar.date(byAdding: .day, value: -1, to: day) ?? day
        }
        return count
    }

    /// Son 7 gecede masal dinlenen gece sayısı (haftalık yıldızlar; boş yıldız "henüz" demektir).
    static func nightsInLastWeek(nights: Set<String>, now: Date, calendar: Calendar = .current) -> Int {
        (0..<7).filter { offset in
            let d = calendar.date(byAdding: .day, value: -offset, to: now) ?? now
            return nights.contains(nightKey(for: d, calendar: calendar))
        }.count
    }

    /// Bölgeye göre çıkartma (aynı bölgede sırayla değişir).
    static func stickerKey(region: Region, index: Int) -> String {
        let options: [String] = switch region {
        case .whisperForest: ["leaf", "acorn"]
        case .starHill: ["star", "moon"]
        case .lighthouseCove: ["shell", "wave"]
        case .storytellerPlane: ["lantern", "book"]
        case .feelingsGarden: ["flower", "heart"]
        case .sleepHouse, .treasureChest: ["moon", "rainbow"]
        }
        return options[abs(index) % options.count]
    }

    /// 7 gece arka arkaya → sıradaki kıyafet. 14, 21… gecede yenileri.
    static func outfitsEarned(consecutiveNights: Int) -> Int { consecutiveNights / 7 }
}

/// Karakter kıyafetleri: 7 gecelik serilerle sırayla açılır.
struct Outfit: Identifiable, Equatable, Sendable {
    enum Style: String, Sendable { case nightcap, scarf, crown, bow }
    let key: String
    let character: CharacterID
    let style: Style
    let color: AccentColor
    var id: String { key }

    var title: String {
        switch key {
        case "pamuk_nightcap": String(localized: "Pamuk'un gece lambası şapkası")
        case "findik_scarf": String(localized: "Fındık'ın yıldızlı atkısı")
        case "lodos_bow": String(localized: "Lodos'un kurdelesi")
        case "nur_nightcap": String(localized: "Nur'un uyku şapkası")
        case "yildiz_crown": String(localized: "Yıldız'ın ay tacı")
        default: String(localized: "Kaptan Midye'nin atkısı")
        }
    }

    static let all: [Outfit] = [
        Outfit(key: "pamuk_nightcap", character: .pamuk, style: .nightcap, color: .berry),
        Outfit(key: "findik_scarf", character: .findik, style: .scarf, color: .sky),
        Outfit(key: "lodos_bow", character: .lodos, style: .bow, color: .grape),
        Outfit(key: "nur_nightcap", character: .nur, style: .nightcap, color: .sky),
        Outfit(key: "yildiz_crown", character: .yildiz, style: .crown, color: .grape),
        Outfit(key: "kaptan_midye_scarf", character: .kaptanMidye, style: .scarf, color: .sun),
    ]

    static func find(_ key: String?) -> Outfit? { all.first { $0.key == key } }
}

/// Masal bitince ödülleri verir. Gece kutlama ekranı yok: ödüller sessizce sandığa girer (isNew).
@MainActor
enum RewardEngine {
    /// - Returns: Yeni kazanılan ödüller (sticker ve/veya kıyafet).
    @discardableResult
    static func storyFinished(_ story: Story, child: ChildProfile, now: Date = .now, calendar: Calendar = .current) -> [Sticker] {
        var earned: [Sticker] = []
        let night = RewardRules.nightKey(for: now, calendar: calendar)
        if !child.listeningNights.contains(night) { child.listeningNights.append(night) }

        // Masal başına bir çıkartma (ilk dinleyişte).
        if !child.stickers.contains(where: { $0.kind == .sticker && $0.storyID == story.id }) {
            let index = child.stickers.filter { $0.kind == .sticker }.count
            let sticker = Sticker(kind: .sticker, assetKey: RewardRules.stickerKey(region: story.region, index: index),
                                  earnedAt: now, storyID: story.id)
            child.stickers.append(sticker)
            earned.append(sticker)
        }

        // 7 gece arka arkaya → kıyafet (her 7'de bir yenisi). Aynı seride aynı eşik iki kez ödüllendirilmez.
        let streak = RewardRules.consecutiveNights(nights: Set(child.listeningNights), now: now, calendar: calendar)
        let due = RewardRules.outfitsEarned(consecutiveNights: streak)
        if due > 0 {
            let runStart = RewardRules.nightKey(
                for: calendar.date(byAdding: .day, value: -(streak - 1), to: now) ?? now, calendar: calendar)
            let outfits = child.stickers.filter { $0.kind == .outfit }
            let earnedThisRun = outfits.filter { RewardRules.nightKey(for: $0.earnedAt, calendar: calendar) >= runStart }.count
            let owned = Set(outfits.map(\.assetKey))
            if earnedThisRun < due, let next = Outfit.all.first(where: { !owned.contains($0.key) }) {
                let outfit = Sticker(kind: .outfit, assetKey: next.key, earnedAt: now)
                child.stickers.append(outfit)
                earned.append(outfit)
                // İlk kez kazanılan kıyafet kendiliğinden giydirilir (çocuk sandıkta görür).
                if child.equippedOutfits[next.character.rawValue] == nil {
                    child.equippedOutfits[next.character.rawValue] = next.key
                }
            }
        }
        return earned
    }

    static func markAllSeen(_ child: ChildProfile) {
        for s in child.stickers where s.isNew { s.isNew = false }
    }
}
