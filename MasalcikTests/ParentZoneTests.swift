import Testing
import Foundation
import SwiftData
@testable import Masalcik

@Suite("Haftalık özet")
struct WeeklySummaryTests {
    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Istanbul")!
        return c
    }
    private func at(_ day: Int, _ h: Int, _ m: Int = 0) -> Date {
        cal.date(from: DateComponents(year: 2026, month: 10, day: day, hour: h, minute: m))!
    }

    @Test func gecYarisiniAsanOrtalamaGeceYarisiOlur() {
        // 23:50 ve 00:10 → ortalama 00:00 (öğlen değil)
        let s = WeeklySummary.make(endTimes: [at(9, 23, 50), at(11, 0, 10)], now: at(11, 12), calendar: cal)
        #expect(s.averageEndMinute == 0)
        #expect(s.stories == 2)
        #expect(s.nights == 2)
    }

    @Test func sonYediGeceSayilir() {
        let s = WeeklySummary.make(endTimes: [at(1, 20, 30), at(9, 20, 30), at(10, 21, 30), at(10, 21, 50)], now: at(11, 12), calendar: cal)
        #expect(s.stories == 3)          // 1 Ekim haftanın dışında
        #expect(s.nights == 2)           // 10 Ekim'de iki masal = bir gece
        #expect(s.averageEndMinute == 21 * 60 + 16)
    }

    @Test func veriYoksaBos() {
        let s = WeeklySummary.make(endTimes: [], now: .now)
        #expect(s == WeeklySummary(stories: 0, nights: 0, averageEndMinute: nil))
        #expect(s.formattedAverage() == nil)
    }
}

/// Hesap silmeyi kaydeden sahte API.
private final class EraseAPI: StoryAPI, @unchecked Sendable {
    var fails: Bool
    var deleteCalls = 0
    init(fails: Bool) { self.fails = fails }
    func generateStory(_ request: StoryRequest, idempotencyKey: String) -> AsyncThrowingStream<StoryStreamEvent, Error> {
        AsyncThrowingStream { $0.finish() }
    }
    func story(id: String) async throws -> StoryDTO { throw APIError.offline }
    func library() async throws -> [LibraryItemDTO] { [] }
    func createVoiceClone(sample: Data, consentedAt: Date) async throws -> VoiceCloneResponseDTO { throw APIError.offline }
    func deleteVoiceClone() async throws {}
    func verifyEntitlement(signedTransaction: String?) async throws -> EntitlementDTO { throw APIError.offline }
    func deleteAccount() async throws {
        deleteCalls += 1
        if fails { throw APIError.offline }
    }
}

@Suite("Ebeveyn Köşesi")
@MainActor
struct ParentZoneTests {
    private func seeded() -> ModelContext {
        TestStore.context(seed: true)
    }

    @Test func aktifCocukSecimi() throws {
        let ctx = seeded()
        let family = try #require(try ctx.fetch(FetchDescriptor<Family>()).first)
        let first = try #require(family.activeChild)
        let second = ChildProfile(name: "Mert", age: 7, createdAt: .now.addingTimeInterval(60))
        family.children.append(second)
        #expect(family.activeChild?.id == first.id)        // seçim yoksa ilk profil
        family.activeChildID = second.id
        #expect(family.activeChild?.id == second.id)
        family.activeChildID = UUID()                      // silinmiş profil → ilk profile düşer
        #expect(family.activeChild?.id == first.id)
    }

    @Test func enFazlaDortProfil() throws {
        let ctx = seeded()
        let family = try #require(try ctx.fetch(FetchDescriptor<Family>()).first)
        for i in 0..<3 { family.children.append(ChildProfile(name: "Çocuk\(i)", age: 5)) }
        #expect(family.children.count == 4)
        #expect(!family.canAddChild)
    }

    @Test func veriSilmeOnceSunucuSonraCihaz() async throws {
        let ctx = seeded()
        let api = EraseAPI(fails: false)
        let auth = AuthSession(baseURL: URL(string: "https://p.supabase.co")!, anonKey: "a", store: MemoryTokenStore())
        try await DataEraser.eraseEverything(api: api, auth: auth, context: ctx)
        #expect(api.deleteCalls == 1)
        #expect(try ctx.fetchCount(FetchDescriptor<Family>()) == 0)
        #expect(try ctx.fetchCount(FetchDescriptor<ChildProfile>()) == 0)
        #expect(try ctx.fetchCount(FetchDescriptor<Story>()) == 0)
        #expect(try ctx.fetchCount(FetchDescriptor<StoryParagraph>()) == 0)
    }

    @Test func sunucuSilinemezseCihazdakiVeriKalir() async throws {
        let ctx = seeded()
        await #expect(throws: APIError.offline) {
            try await DataEraser.eraseEverything(api: EraseAPI(fails: true), auth: nil, context: ctx)
        }
        #expect(try ctx.fetchCount(FetchDescriptor<Family>()) == 1)   // yarım silme yok
    }

    @Test func icerikFiltreleriVarsayilanKapali() {
        let s = AppSettings()
        #expect(!s.contentFilters.allowMildScary)
        #expect(!s.contentFilters.allowConflict)
        #expect(!s.contentFilters.allowLossAndSeparation)
        #expect(!s.subtitlesEnabled)       // altyazı varsayılan kapalı (§3.4)
    }

    @Test func sahteApiPaylasimBaglantisi() async throws {
        let url = try await MockStoryAPI(paragraphDelay: .zero, language: .tr).shareStory(id: "story-12345678")
        #expect(url.absoluteString.hasPrefix("https://masalcik.app/s/"))
    }
}
