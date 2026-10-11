import Testing
import Foundation
import SwiftData
@testable import Masalcik

@Suite("Bu Gece: seçenekler")
struct TonightOptionsTests {
    @Test func karakterlerdeYoldasIlkSirada() {
        for seed: UInt64 in [1, 2, 3, 99] {
            let opts = TonightOptions.characters(companion: .lodos, seed: seed)
            #expect(opts.count == 3)
            #expect(opts.first == .lodos)
            #expect(Set(opts).count == 3)
        }
    }

    @Test func ayniGeceAyniSecenekler() {
        let id = UUID()
        let day = Date(timeIntervalSince1970: 1_791_000_000)
        let s1 = TonightOptions.seed(date: day, childID: id)
        let s2 = TonightOptions.seed(date: day.addingTimeInterval(3600), childID: id)
        #expect(TonightOptions.characters(companion: .pamuk, seed: s1) == TonightOptions.characters(companion: .pamuk, seed: s2))
    }

    @Test func bolgelerAcikOlanlardanVeIlgiAlaniOnde() {
        let unlocked: [Region] = [.sleepHouse, .whisperForest, .storytellerPlane, .starHill]
        let opts = TonightOptions.regions(unlocked: unlocked, interests: [.space], seed: 7)
        #expect(opts.first == .starHill)
        #expect(opts.count == 3)
        #expect(opts.allSatisfy(unlocked.contains))
        // Kilitli bölgeye uyan ilgi alanı öne çıkmaz
        let locked = TonightOptions.regions(unlocked: [.sleepHouse, .whisperForest, .storytellerPlane], interests: [.sea], seed: 7)
        #expect(!locked.contains(.lighthouseCove))
        // Hazine Sandığı bir masal mekânı değildir
        #expect(!TonightOptions.regions(unlocked: Region.allCases, interests: [], seed: 1).contains(.treasureChest))
    }

    @Test func uykuSaatindeSakinOnde() {
        #expect(TonightOptions.moods(isBedtimeNear: true).first == .calm)
        #expect(Set(TonightOptions.moods(isBedtimeNear: false)) == Set(StoryMood.allCases))
    }

    @Test func pamukSecer() {
        let p = TonightOptions.pamukPicks(companion: .yildiz, unlocked: [.sleepHouse, .whisperForest], interests: [.animals], seed: 3)
        #expect(p.character == .yildiz)
        #expect(p.region == .whisperForest)
        #expect(p.mood == .calm)
    }

    @Test func hataPolitikasi() {
        #expect(TonightFailurePolicy.action(for: APIError.dailyLimitReached) == .showLibraryOffer)
        #expect(TonightFailurePolicy.action(for: APIError.offline) == .playLocalFallback)
        #expect(TonightFailurePolicy.action(for: APIError.unsafeInput) == .playLocalFallback)
        #expect(TonightFailurePolicy.action(for: URLError(.timedOut)) == .playLocalFallback)
    }
}

/// Hata döndüren sahte API.
private struct FailingAPI: StoryAPI {
    let error: APIError
    func generateStory(_ request: StoryRequest, idempotencyKey: String) -> AsyncThrowingStream<StoryStreamEvent, Error> {
        AsyncThrowingStream { $0.finish(throwing: error) }
    }
    func story(id: String) async throws -> StoryDTO { throw error }
    func library() async throws -> [LibraryItemDTO] { [] }
    func createVoiceClone(sample: Data, consentedAt: Date) async throws -> VoiceCloneResponseDTO { throw error }
    func deleteVoiceClone() async throws {}
    func verifyEntitlement(signedTransaction: String?) async throws -> EntitlementDTO { throw error }
    func deleteAccount() async throws {}
}

/// Aynı idempotency anahtarının kullanıldığını doğrulamak için kaydeden sahte API.
private final class RecordingAPI: StoryAPI, @unchecked Sendable {
    var keys: [String] = []
    let inner = MockStoryAPI(paragraphDelay: .zero, language: .tr)
    func generateStory(_ request: StoryRequest, idempotencyKey: String) -> AsyncThrowingStream<StoryStreamEvent, Error> {
        keys.append(idempotencyKey)
        return inner.generateStory(request, idempotencyKey: idempotencyKey)
    }
    func story(id: String) async throws -> StoryDTO { try await inner.story(id: id) }
    func library() async throws -> [LibraryItemDTO] { try await inner.library() }
    func createVoiceClone(sample: Data, consentedAt: Date) async throws -> VoiceCloneResponseDTO { try await inner.createVoiceClone(sample: sample, consentedAt: consentedAt) }
    func deleteVoiceClone() async throws {}
    func verifyEntitlement(signedTransaction: String?) async throws -> EntitlementDTO { try await inner.verifyEntitlement(signedTransaction: signedTransaction) }
    func deleteAccount() async throws {}
}

@Suite("Bu Gece: akış")
@MainActor
struct TonightFlowTests {
    private func makeChild(_ ctx: ModelContext) -> ChildProfile {
        let family = Family(hasCompletedOnboarding: true)
        family.settings = AppSettings()
        let child = ChildProfile(name: "Ayşe", age: 5, interests: [.animals], companion: .findik)
        family.children.append(child)
        ctx.insert(family)
        return child
    }

    private func waitUntil(_ condition: @MainActor () -> Bool) async {
        for _ in 0..<200 where !condition() { try? await Task.sleep(for: .milliseconds(10)) }
    }

    @Test func secimlerdenOynaticiya() async throws {
        let ctx = PersistenceController(inMemory: true).container.mainContext
        let child = makeChild(ctx)
        let api = RecordingAPI()
        let model = TonightModel(api: api, context: ctx, child: child, settings: nil, isBedtimeNear: true, language: .tr)
        #expect(model.step == .greeting)
        model.begin()
        model.choose(model.characterOptions[0])
        #expect(model.step == .region)
        model.back()
        #expect(model.step == .character)
        model.choose(CharacterID.findik)
        model.choose(model.regionOptions[0])
        model.choose(StoryMood.calm)
        #expect(model.step == .generating || model.step == .playing)
        await waitUntil { model.player?.engine.isStreamComplete == true }

        #expect(model.step == .playing)
        let story = try #require(model.player?.story)
        #expect(story.paragraphs.count == 7)
        #expect(story.title == "Ayşe ve Kayıp Fener")
        #expect(child.stories.contains { $0.id == story.id })
        // Masalda doğan karakter çocuğun hafızasına yazıldı
        #expect(child.recurringCharacters.map(\.name) == ["Fener Tavşan"])
        #expect(api.keys.count == 1)
        #expect(!model.usedLocalFallback)
        model.cancel()
    }

    @Test func pamukSecsinTekDokunus() async {
        let ctx = PersistenceController(inMemory: true).container.mainContext
        let model = TonightModel(api: MockStoryAPI(paragraphDelay: .zero, language: .tr), context: ctx, child: makeChild(ctx),
                                 settings: nil, isBedtimeNear: false, language: .tr)
        model.begin()
        model.letPamukChoose()
        #expect(model.mood == .calm)
        #expect(model.character == .findik)
        await waitUntil { model.step == .playing }
        #expect(model.step == .playing)
        model.cancel()
    }

    @Test func agYoksaYerelGuvenliMasal() async {
        let ctx = PersistenceController(inMemory: true).container.mainContext
        let model = TonightModel(api: FailingAPI(error: .offline), context: ctx, child: makeChild(ctx),
                                 settings: nil, isBedtimeNear: false, language: .tr)
        model.begin(); model.letPamukChoose()
        await waitUntil { model.step == .playing }
        #expect(model.step == .playing)
        #expect(model.usedLocalFallback)
        #expect(model.player?.story.paragraphs.isEmpty == false)
        model.cancel()
    }

    @Test func limitDolundaKitaplikOnerisiSatinAlmaYok() async {
        let ctx = PersistenceController(inMemory: true).container.mainContext
        let model = TonightModel(api: FailingAPI(error: .dailyLimitReached), context: ctx, child: makeChild(ctx),
                                 settings: nil, isBedtimeNear: false, language: .tr)
        model.begin(); model.letPamukChoose()
        await waitUntil { model.step == .libraryOffer }
        #expect(model.step == .libraryOffer)
        #expect(model.player == nil)
        #expect(!TonightLines.libraryOffer.lowercased().contains("satın"))
    }
}
