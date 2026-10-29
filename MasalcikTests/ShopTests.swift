import Testing
import Foundation
@testable import Masalcik

@Suite("Masal Dükkanı", .serialized)
@MainActor
struct ShopTests {
    private func model(_ service: MockPurchaseService = MockPurchaseService(),
                       received: @escaping (EntitlementDTO) -> Void = { _ in }) -> ShopModel {
        MockStoreState.shared.reset()
        return ShopModel(api: MockStoryAPI(paragraphDelay: .zero, language: .tr), service: service,
                         onEntitlement: received)
    }

    @Test func katalogVeFiyatlarYuklenir() async {
        let m = model()
        await m.load()
        #expect(m.phase == .ready)
        #expect(m.items.map(\.id) == ["masalcik.pack.dedekorkut", "masalcik.pack.space", "masalcik.pack.outfits.bayram"])
        #expect(m.items.allSatisfy { $0.price != nil && !m.isOwned($0) })
        #expect(m.items[1].pack.stories.count == 4)
        #expect(m.items[2].pack.outfits.count == 6)
    }

    @Test func paketSatinAlinincaSahipOlunurPremiumGelmez() async {
        var received: EntitlementDTO?
        let m = model { received = $0 }
        await m.load()
        let space = m.items[1]
        await m.buy(space)
        #expect(m.isOwned(m.items[1]))
        #expect(m.notice == .purchased("Uzay Yolculuğu"))
        #expect(received?.ownedProducts == ["masalcik.pack.space"])
        #expect(received?.tier == .free, "paket abonelik değildir")
    }

    @Test func fiyatiOlmayanVeSahipOlunanPaketAlinmaz() async {
        let service = MockPurchaseService()
        service.packPriceList = ["masalcik.pack.space": "₺59,99"]
        let m = model(service)
        await m.load()
        await m.buy(m.items[0])                    // fiyat yok
        #expect(service.purchasedIDs.isEmpty)
        await m.buy(m.items[1])
        await m.buy(m.items[1])                    // ikinci kez
        #expect(service.purchasedIDs == ["masalcik.pack.space"])
    }

    @Test func hataVeOnayBekleme() async {
        let service = MockPurchaseService()
        service.nextResult = .failure(APIError.offline)
        let m = model(service)
        await m.load()
        await m.buy(m.items[0])
        #expect(m.notice == .failed)
        service.nextResult = .success(.pending)
        await m.buy(m.items[0])
        #expect(m.notice == .pending)
        #expect(!m.isOwned(m.items[0]))
    }

    @Test func cocukTarafiSahipOlunmayanPaketiGormez() {
        let pack = LibraryItemDTO(id: "lib-space-balon", title: "x", region: .starHill, durationMinutes: 10,
                                  coverUrl: nil, isFree: false, packId: "masalcik.pack.space")
        let free = LibraryItemDTO(id: "lib-hoca-1", title: "y", region: .storytellerPlane, durationMinutes: 5,
                                  coverUrl: nil, isFree: true)
        #expect(!PackVisibility.isVisible(pack, ownedPacks: []))
        #expect(PackVisibility.isVisible(pack, ownedPacks: ["masalcik.pack.space"]))
        #expect(PackVisibility.isVisible(free, ownedPacks: []))
        #expect(PackVisibility.isPlayableWithoutPremium(pack, ownedPacks: ["masalcik.pack.space"]))
        #expect(!PackVisibility.isPlayableWithoutPremium(pack, ownedPacks: []))
    }

    @Test func paketKiyafetleriSeriyleKazanilmazGizlidir() {
        #expect(Outfit.earnable.allSatisfy { $0.pack == nil })
        #expect(Outfit.visible(ownedPacks: []).count == Outfit.earnable.count)
        #expect(Outfit.visible(ownedPacks: ["masalcik.pack.outfits.bayram"]).count == Outfit.all.count)
        #expect(Set(Outfit.all.map(\.key)).count == Outfit.all.count, "anahtarlar benzersiz")
    }
}
