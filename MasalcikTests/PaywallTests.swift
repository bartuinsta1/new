import Testing
import Foundation
import SwiftData
@testable import Masalcik

@Suite("Paywall")
@MainActor
struct PaywallModelTests {
    private let now = Date(timeIntervalSince1970: 1_791_000_000)
    private let premium = EntitlementDTO(tier: .premium, productId: PremiumProductID.yearly,
                                         expiresAt: Date(timeIntervalSince1970: 1_791_604_800), isInTrial: true,
                                         personalStoriesRemainingToday: nil, libraryStoriesRemainingThisWeek: nil)

    private func make(_ service: MockPurchaseService, received: @escaping (EntitlementDTO) -> Void = { _ in }) -> PaywallModel {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Istanbul")!
        return PaywallModel(service: service, now: { now }, calendar: cal, onEntitlement: received)
    }

    @Test func yillikSeciliDenemeBitisiYediGunSonra() async {
        let model = make(MockPurchaseService())
        await model.load()
        #expect(model.phase == .ready)
        #expect(model.selectedID == PremiumProductID.yearly)
        #expect(model.trialEndDate == now.addingTimeInterval(7 * 86_400))
        // 449,99 / (79,99 × 12) = 0,468 → %53 (aşağı yuvarlanır, abartı yok)
        #expect(model.yearlySavingsPercent == 53)
    }

    @Test func denemeyeUygunDegilseBitisTarihiYok() async {
        let catalog = MockPurchaseService.turkishCatalog.map { var p = $0; p.trialDays = nil; return p }
        let model = make(MockPurchaseService(catalog: catalog))
        await model.load()
        #expect(model.trialEndDate == nil)
    }

    @Test func satinAlmaBasarili() async {
        let service = MockPurchaseService()
        service.nextResult = .success(.purchased(premium))
        var received: EntitlementDTO?
        let model = make(service) { received = $0 }
        await model.load()
        model.select(MockPurchaseService.turkishCatalog[1])
        await model.purchase()
        #expect(service.purchasedIDs == [PremiumProductID.monthly])
        #expect(model.phase == .purchased)
        #expect(received == premium)
    }

    @Test func vazgecmeSessizceGeriDoner() async {
        let service = MockPurchaseService()
        service.nextResult = .success(.cancelled)
        let model = make(service)
        await model.load()
        await model.purchase()
        #expect(model.phase == .ready)
        #expect(model.notice == nil)
    }

    @Test func onayBekleyenSatinAlma() async {
        let service = MockPurchaseService()
        service.nextResult = .success(.pending)
        let model = make(service)
        await model.load()
        await model.purchase()
        #expect(model.phase == .pending)
    }

    @Test func hataBildirilir() async {
        let service = MockPurchaseService()
        service.nextResult = .failure(APIError.offline)
        let model = make(service)
        await model.load()
        await model.purchase()
        #expect(model.phase == .ready)
        #expect(model.notice == .purchaseFailed)
    }

    @Test func geriYuklemeBulamazsaSoyler() async {
        let model = make(MockPurchaseService())
        await model.load()
        await model.restore()
        #expect(model.phase == .ready)
        #expect(model.notice == .nothingToRestore)
    }

    @Test func fiyatYoksaGeriYuklemeYineCalisir() async {
        let service = MockPurchaseService(catalog: [])
        service.restoreResult = .success(premium)
        var received: EntitlementDTO?
        let model = make(service) { received = $0 }
        await model.load()
        #expect(model.phase == .unavailable)
        await model.restore()
        #expect(model.phase == .purchased)
        #expect(model.notice == .restored)
        #expect(received == premium)
    }

    @Test func yillikAylikKarsiligi() {
        let yearly = MockPurchaseService.turkishCatalog[0]
        // 449,99 / 12 = 37,499… → biçim dile göre ("₺37,50" / "TRY 37.50"); rakamlar aynı.
        #expect(yearly.monthlyEquivalent.contains("37"))
    }
}

@Suite("Paywall ne zaman önerilir")
@MainActor
struct PaywallPolicyTests {
    /// Kapsayıcı test boyunca yaşamalı (modeller ona bağlı).
    private let container = PersistenceController(inMemory: true).container

    private func family(listened: Bool, premium: Bool = false, onboarded: Bool = true) -> Family {
        let ctx = container.mainContext
        let family = Family(hasCompletedOnboarding: onboarded)
        let child = ChildProfile(name: "Ela", age: 5)
        ctx.insert(family)
        family.children = [child]
        let story = Story(id: "s1", title: "x", region: .starHill, mood: .calm, characters: [.yildiz], durationMinutes: 5,
                          playCount: listened ? 1 : 0)
        child.stories = [story]
        if premium { family.entitlement = Entitlement(tier: .premium) }
        return family
    }

    @Test func ilkMasaldanOnceYok() {
        #expect(!PaywallPolicy.canOffer(family: family(listened: false)))
        #expect(!PaywallPolicy.canOffer(family: nil))
    }

    @Test func ilkMasaldanSonraVar() {
        #expect(PaywallPolicy.canOffer(family: family(listened: true)))
    }

    @Test func premiumaVeOnboardingSirasindaYok() {
        #expect(!PaywallPolicy.canOffer(family: family(listened: true, premium: true)))
        #expect(!PaywallPolicy.canOffer(family: family(listened: true, onboarded: false)))
    }
}

@Suite("Kitaplık limiti hata kodları")
struct LibraryLimitErrorTests {
    private func response(_ status: Int, code: String?) -> HTTPURLResponse {
        HTTPURLResponse(url: URL(string: "https://x")!, statusCode: status, httpVersion: nil,
                        headerFields: code.map { ["X-Error-Code": $0] } ?? [:])!
    }

    @Test func kodlarDogruEslenir() {
        #expect(throws: APIError.weeklyLimitReached) { try LiveStoryAPI.check(response(403, code: "weekly_limit_reached")) }
        #expect(throws: APIError.premiumRequired) { try LiveStoryAPI.check(response(402, code: "premium_required")) }
        #expect(throws: APIError.dailyLimitReached) { try LiveStoryAPI.check(response(402, code: "daily_limit_reached")) }
        #expect(throws: APIError.server(status: 403)) { try LiveStoryAPI.check(response(403, code: nil)) }
    }
}
