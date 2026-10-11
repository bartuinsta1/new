import Foundation

/// "Bu Gece" seçim baloncukları (§3.3): her adımda 3 seçenek. Saf mantık; testli.
/// Seçenekler aynı gece içinde sabittir (tohum = tarih + çocuk), böylece geri dönünce baloncuklar yer değiştirmez.
enum TonightOptions {
    /// "Kim olsun?": yoldaş karakter her zaman ilk sırada + 2 farklı karakter.
    static func characters(companion: CharacterID, seed: UInt64) -> [CharacterID] {
        var rng = SplitMix64(seed: seed)
        let others = CharacterID.allCases.filter { $0 != companion }.shuffled(using: &rng)
        return [companion] + others.prefix(2)
    }

    /// "Nerede geçsin?": açık bölgelerden 3 tane. Çocuğun ilgi alanına uyan bölge varsa mutlaka içinde.
    static func regions(unlocked: [Region], interests: [Interest], seed: UInt64) -> [Region] {
        var rng = SplitMix64(seed: seed &+ 1)
        let candidates = unlocked.filter { $0 != .treasureChest }
        guard !candidates.isEmpty else { return [.sleepHouse] }
        let preferred = interests.compactMap(region(for:)).filter(candidates.contains)
        var result: [Region] = []
        if let first = preferred.first { result.append(first) }
        for r in candidates.shuffled(using: &rng) where !result.contains(r) && result.count < 3 { result.append(r) }
        return result
    }

    /// "Ne olsun?": üç masal havası; uyku saatine yakınsa "sakin" ilk sırada ve önerilen.
    static func moods(isBedtimeNear: Bool) -> [StoryMood] {
        isBedtimeNear ? [.calm, .adventure, .funny] : [.adventure, .funny, .calm]
    }

    /// İlgi alanı → bölge eşlemesi.
    static func region(for interest: Interest) -> Region? {
        switch interest {
        case .animals, .nature, .dinosaurs: .whisperForest
        case .space, .superheroes: .starHill
        case .sea, .vehicles: .lighthouseCove
        case .princesses, .music: .storytellerPlane
        case .football: .feelingsGarden
        }
    }

    /// "Pamuk seçsin": tek dokunuşla yoldaş + ilgi alanına uygun bölge + sakin masal.
    static func pamukPicks(companion: CharacterID, unlocked: [Region], interests: [Interest], seed: UInt64)
        -> (character: CharacterID, region: Region, mood: StoryMood) {
        (companion, regions(unlocked: unlocked, interests: interests, seed: seed).first ?? .sleepHouse, .calm)
    }

    /// Gece ve çocuğa göre sabit tohum.
    static func seed(date: Date, childID: UUID, calendar: Calendar = .current) -> UInt64 {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        let day = UInt64((c.year ?? 0) * 10_000 + (c.month ?? 0) * 100 + (c.day ?? 0))
        let childBits = childID.uuid.0 ^ childID.uuid.5 ^ childID.uuid.10 ^ childID.uuid.15
        return day &* 1_000_003 &+ UInt64(childBits)
    }
}

/// Akış sırasında karşılaşılan duruma göre ne yapılacağı (çocuk hiçbir zaman hata ekranı görmez).
enum TonightFailurePolicy {
    enum Action: Equatable { case showLibraryOffer, playLocalFallback }

    static func action(for error: Error) -> Action {
        if let api = error as? APIError, api == .dailyLimitReached { return .showLibraryOffer }
        // Ağ yok, sunucu hatası, zaman aşımı, uygunsuz girdi (ebeveyne Ebeveyn Köşesi'nde bildirilir):
        // cihazdaki güvenli masalla devam.
        return .playLocalFallback
    }
}
