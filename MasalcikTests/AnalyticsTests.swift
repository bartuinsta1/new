import Testing
import Foundation
@testable import Masalcik

/// Olayları kaydeden (ya da başarısız olan) sahte API.
private final class EventsAPI: StoryAPI, @unchecked Sendable {
    var sent: [[AnalyticsEventDTO]] = []
    var fails = false
    func generateStory(_ request: StoryRequest, idempotencyKey: String) -> AsyncThrowingStream<StoryStreamEvent, Error> {
        AsyncThrowingStream { $0.finish() }
    }
    func story(id: String) async throws -> StoryDTO { throw APIError.offline }
    func library() async throws -> [LibraryItemDTO] { [] }
    func createVoiceClone(sample: Data, consentedAt: Date) async throws -> VoiceCloneResponseDTO { throw APIError.offline }
    func deleteVoiceClone() async throws {}
    func verifyEntitlement(signedTransaction: String?) async throws -> EntitlementDTO { throw APIError.offline }
    func deleteAccount() async throws {}
    func sendEvents(_ events: [AnalyticsEventDTO]) async throws {
        if fails { throw APIError.offline }
        sent.append(events)
    }
}

@Suite("Analitik")
@MainActor
struct AnalyticsTests {
    private func freshDefaults() -> UserDefaults {
        let d = UserDefaults(suiteName: "analytics-test-\(UUID().uuidString)")!
        return d
    }

    @Test func olaylarSunucuBicimindeVeKimliksiz() {
        let e = AnalyticsEvent.storyStarted(region: .starHill, mood: .calm, isLibrary: false).dto
        #expect(e.name == "story_started")
        #expect(e.dims == ["region": .string("star_hill"), "mood": .string("calm"), "library": .bool(false)])
        #expect(AnalyticsEvent.paywallPurchased(yearly: true).dto.dims == ["plan": .string("yearly")])
        #expect(AnalyticsEvent.paywallShown.dto.dims.isEmpty)
    }

    @Test func sureKabaAraliklaGider() {
        #expect(AnalyticsEvent.minutesBucket(30) == "0-5")
        #expect(AnalyticsEvent.minutesBucket(7 * 60) == "5-10")
        #expect(AnalyticsEvent.minutesBucket(14 * 60 + 59) == "10-15")
        #expect(AnalyticsEvent.minutesBucket(40 * 60) == "15+")
    }

    @Test func gonderilemeyenlerSaklanirSonraGider() async {
        let defaults = freshDefaults()
        let api = EventsAPI()
        api.fails = true
        let a = Analytics(defaults: defaults)
        a.api = api
        a.track(.paywallShown)
        a.track(.paywallClosed)
        await a.flush()
        #expect(a.buffer.count == 2)
        // Uygulama yeniden açıldı: bekleyenler diskten gelir.
        let reopened = Analytics(defaults: defaults)
        #expect(reopened.buffer.count == 2)
        api.fails = false
        reopened.api = api
        await reopened.flush()
        #expect(reopened.buffer.isEmpty)
        #expect(api.sent.first?.map(\.name) == ["paywall_shown", "paywall_closed"])
    }

    @Test func bekleyenSiniriVeSilme() {
        let a = Analytics(defaults: freshDefaults())
        for _ in 0..<(Analytics.maxPending + 30) { a.track(.paywallShown) }
        #expect(a.buffer.count == Analytics.maxPending)
        a.clear()
        #expect(a.buffer.isEmpty)
    }

    @Test func degerKodlamasiGidipGelir() throws {
        let e = AnalyticsEventDTO(name: "x", dims: ["a": .int(3), "b": .bool(true), "c": .string("s")])
        let data = try JSONEncoder().encode(e)
        #expect(try JSONDecoder().decode(AnalyticsEventDTO.self, from: data) == e)
    }
}
