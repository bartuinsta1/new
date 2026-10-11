import Testing
import Foundation
import SwiftData
@testable import Masalcik

@Suite("Hazine Sandığı kuralları")
struct RewardRulesTests {
    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Istanbul")!
        return c
    }
    private func at(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
        cal.date(from: DateComponents(year: 2026, month: 10, day: day, hour: hour, minute: minute))!
    }

    @Test func geceYarisindanSonraOncekiGeceyeSayilir() {
        #expect(RewardRules.nightKey(for: at(10, 20), calendar: cal) == "2026-10-10")
        #expect(RewardRules.nightKey(for: at(11, 0, 30), calendar: cal) == "2026-10-10")
        #expect(RewardRules.nightKey(for: at(11, 5, 59), calendar: cal) == "2026-10-10")
        #expect(RewardRules.nightKey(for: at(11, 6, 0), calendar: cal) == "2026-10-11")
    }

    @Test func seriBuGeceDinlenmediyseDuneKadarSayilir() {
        let nights: Set<String> = ["2026-10-08", "2026-10-09", "2026-10-10"]
        // 11 Ekim akşamı, henüz masal yok: seri "bozulmadı", 3
        #expect(RewardRules.consecutiveNights(nights: nights, now: at(11, 19), calendar: cal) == 3)
        // 12 Ekim: 11 Ekim boş geçti → yeni seri 0 (ceza mesajı yok; yalnızca sayı)
        #expect(RewardRules.consecutiveNights(nights: nights, now: at(12, 19), calendar: cal) == 0)
        #expect(RewardRules.consecutiveNights(nights: nights.union(["2026-10-11"]), now: at(11, 21), calendar: cal) == 4)
    }

    @Test func haftalikYildizlar() {
        let nights: Set<String> = ["2026-10-04", "2026-10-06", "2026-10-09", "2026-10-10"]
        #expect(RewardRules.nightsInLastWeek(nights: nights, now: at(10, 21), calendar: cal) == 4)
        #expect(RewardRules.nightsInLastWeek(nights: nights, now: at(17, 21), calendar: cal) == 0)
    }

    @Test func bolgeyeGoreCikartmaVeKiyafetEsikleri() {
        #expect(RewardRules.stickerKey(region: .starHill, index: 0) == "star")
        #expect(RewardRules.stickerKey(region: .starHill, index: 1) == "moon")
        for region in Region.allCases {
            for i in 0..<4 { #expect(StickerCatalog.all.contains { $0.key == RewardRules.stickerKey(region: region, index: i) }) }
        }
        #expect(RewardRules.outfitsEarned(consecutiveNights: 6) == 0)
        #expect(RewardRules.outfitsEarned(consecutiveNights: 7) == 1)
        #expect(RewardRules.outfitsEarned(consecutiveNights: 14) == 2)
        #expect(Set(Outfit.all.map(\.character)).count == Outfit.all.count)   // her karaktere bir kıyafet
    }
}

@Suite("Ödül motoru")
@MainActor
struct RewardEngineTests {
    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Istanbul")!
        return c
    }
    private func night(_ day: Int) -> Date {
        cal.date(from: DateComponents(year: 2026, month: 10, day: day, hour: 20))!
    }

    private func setup() -> (ModelContext, ChildProfile) {
        let ctx = PersistenceController(inMemory: true).container.mainContext
        let child = ChildProfile(name: "Ayşe", age: 5)
        ctx.insert(child)
        return (ctx, child)
    }

    private func story(_ id: String, _ ctx: ModelContext) -> Story {
        let s = Story(id: id, title: id, region: .whisperForest, mood: .calm, characters: [.findik], durationMinutes: 5)
        ctx.insert(s)
        return s
    }

    @Test func masalBasinaBirCikartma() {
        let (ctx, child) = setup()
        let s = story("s1", ctx)
        let first = RewardEngine.storyFinished(s, child: child, now: night(1), calendar: cal)
        #expect(first.map(\.kind) == [.sticker])
        #expect(first.first?.assetKey == "leaf")
        #expect(first.first?.isNew == true)
        // Aynı masalı tekrar dinlemek yeni çıkartma vermez
        #expect(RewardEngine.storyFinished(s, child: child, now: night(2), calendar: cal).isEmpty)
        #expect(child.listeningNights == ["2026-10-01", "2026-10-02"])
    }

    @Test func yediGeceArkaArkayaKiyafet() {
        let (ctx, child) = setup()
        var outfits: [Sticker] = []
        for day in 1...7 {
            outfits += RewardEngine.storyFinished(story("s\(day)", ctx), child: child, now: night(day), calendar: cal)
                .filter { $0.kind == .outfit }
        }
        #expect(outfits.map(\.assetKey) == ["pamuk_nightcap"])
        #expect(child.equippedOutfits["pamuk"] == "pamuk_nightcap")   // ilk kıyafet kendiliğinden giyilir
        // Aynı gece ikinci masal: ikinci kıyafet yok
        #expect(RewardEngine.storyFinished(story("s7b", ctx), child: child, now: night(7).addingTimeInterval(1800), calendar: cal)
            .filter { $0.kind == .outfit }.isEmpty)
        // 14. gecede ikincisi
        var more: [Sticker] = []
        for day in 8...14 {
            more += RewardEngine.storyFinished(story("t\(day)", ctx), child: child, now: night(day), calendar: cal).filter { $0.kind == .outfit }
        }
        #expect(more.map(\.assetKey) == ["findik_scarf"])
    }

    @Test func araVerilenGeceCezaDegilYeniSeri() {
        let (ctx, child) = setup()
        for day in [1, 2, 3, 4, 5, 6] { RewardEngine.storyFinished(story("a\(day)", ctx), child: child, now: night(day), calendar: cal) }
        // 7. gece atlandı; 8–14 arka arkaya → kıyafet yine kazanılır, eskiler silinmez
        let stickersBefore = child.stickers.count
        var outfits: [Sticker] = []
        for day in 8...14 {
            outfits += RewardEngine.storyFinished(story("b\(day)", ctx), child: child, now: night(day), calendar: cal).filter { $0.kind == .outfit }
        }
        #expect(outfits.count == 1)
        #expect(child.stickers.count > stickersBefore)
    }

    @Test func gorulduIsaretleme() {
        let (ctx, child) = setup()
        RewardEngine.storyFinished(story("s1", ctx), child: child, now: night(1), calendar: cal)
        #expect(child.newRewardCount == 1)
        RewardEngine.markAllSeen(child)
        #expect(child.newRewardCount == 0)
    }
}

@Suite("Kitaplık rafları")
@MainActor
struct LibraryShelvesTests {
    @Test func raflarFavoriBenimKitaplik() {
        let ctx = PersistenceController(inMemory: true).container.mainContext
        func make(_ id: String, played: Int, fav: Bool = false, library: Bool = false, at: TimeInterval) -> Story {
            let s = Story(id: id, title: id, region: .starHill, mood: .calm, characters: [.yildiz], durationMinutes: 5,
                          isLibraryStory: library, isFavorite: fav, lastPlayedAt: Date(timeIntervalSince1970: at), playCount: played)
            s.paragraphs = [StoryParagraph(index: 0, text: "x", sceneHint: "", emotion: .neutral)]
            ctx.insert(s)
            return s
        }
        let stories = [
            make("a", played: 1, at: 100), make("b", played: 2, at: 300), make("fav", played: 1, fav: true, at: 50),
            make("lib", played: 1, library: true, at: 200), make("never", played: 0, at: 400),
        ]
        let shelves = LibraryShelves.shelves(from: stories)
        #expect(shelves.map(\.kind) == [.favorites, .mine, .library])
        #expect(shelves[1].stories.map(\.id) == ["b", "a"])           // en son dinlenen önde
        #expect(!shelves.flatMap(\.stories).contains { $0.id == "never" })
        #expect(LibraryShelves.shelves(from: []).isEmpty)
    }
}
