import Testing
import Foundation
import SwiftData
@testable import Masalcik

@Suite("SwiftData modelleri")
@MainActor
struct ModelTests {
    @Test func aileSilinceHerSeySilinir() throws {
        let ctx = TestStore.context(seed: true)
        #expect(try ctx.fetchCount(FetchDescriptor<ChildProfile>()) == 1)
        #expect(try ctx.fetchCount(FetchDescriptor<StoryParagraph>()) == 2)

        for f in try ctx.fetch(FetchDescriptor<Family>()) { ctx.delete(f) }
        try ctx.save()
        #expect(try ctx.fetchCount(FetchDescriptor<ChildProfile>()) == 0)
        #expect(try ctx.fetchCount(FetchDescriptor<Story>()) == 0)
        #expect(try ctx.fetchCount(FetchDescriptor<StoryParagraph>()) == 0)
    }

    @Test func telaffuzVarsaOOkunur() {
        let c = ChildProfile(name: "Ece", age: 4, pronunciation: "  E-ce  ")
        #expect(c.spokenName == "E-ce")
        c.pronunciation = "   "
        #expect(c.spokenName == "Ece")
    }

    @Test func istekProfildenKurulur() throws {
        let ctx = TestStore.context(seed: true)
        let child = try #require(try ctx.fetch(FetchDescriptor<ChildProfile>()).first)
        let req = StoryEngineClient.makeRequest(child: child, settings: AppSettings(), region: .starHill, mood: .calm)
        #expect(req.childName == "Ayşe")
        #expect(req.companionCharacter == .findik)
        #expect(req.recentStoryTitles == ["Ayşe ve Uykucu Yıldız"])
        #expect(req.contentFilters == .default)
        #expect(req.durationMinutes == 10)
    }

    @Test func suresiDolanPremiumGecersiz() {
        #expect(!Entitlement(tier: .premium, expiresAt: .now.addingTimeInterval(-60)).isPremium)
        #expect(Entitlement(tier: .premium, expiresAt: .now.addingTimeInterval(60)).isPremium)
        #expect(!Entitlement(tier: .free).isPremium)
    }
}
