import Foundation
import Observation

/// Masal Dükkanı: tek seferlik, kalıcı paketler. Jeton/kredi yok; bir kez alınır, hep kalır.
/// Premium aboneliğe dahil değildir (ekranda açıkça yazar). Yalnızca ebeveyn kapısının arkasında açılır.
@MainActor
@Observable
final class ShopModel {
    enum Phase: Equatable { case loading, ready, unavailable }
    enum Notice: Equatable { case purchased(String), pending, failed, restored, nothingToRestore }

    struct Item: Identifiable, Equatable {
        let pack: PackDTO
        /// App Store fiyatı; nil ise ürün App Store'da bulunamadı (satın alma düğmesi gösterilmez).
        let price: String?
        var id: String { pack.id }
    }

    private(set) var phase: Phase = .loading
    private(set) var items: [Item] = []
    /// Şu an satın alınan paket (düğmede ilerleme göstergesi).
    private(set) var buying: String?
    private(set) var restoring = false
    var notice: Notice?

    private let api: StoryAPI
    private let service: PurchaseService
    private let ownedLocally: () -> Set<String>
    private let onEntitlement: @MainActor (EntitlementDTO) -> Void

    init(api: StoryAPI, service: PurchaseService, ownedLocally: @escaping () -> Set<String> = { [] },
         onEntitlement: @escaping @MainActor (EntitlementDTO) -> Void = { _ in }) {
        self.api = api
        self.service = service
        self.ownedLocally = ownedLocally
        self.onEntitlement = onEntitlement
    }

    func isOwned(_ item: Item) -> Bool { item.pack.owned || ownedLocally().contains(item.id) }

    func load() async {
        phase = .loading
        do {
            let packs = try await api.packs()
            let prices = (try? await service.packPrices(packs.map(\.id))) ?? [:]
            items = packs.map { Item(pack: $0, price: prices[$0.id]) }
            phase = items.isEmpty ? .unavailable : .ready
        } catch {
            phase = .unavailable
        }
    }

    func buy(_ item: Item) async {
        guard buying == nil, !restoring, !isOwned(item), item.price != nil else { return }
        buying = item.id
        defer { buying = nil }
        do {
            switch try await service.purchase(item.id) {
            case .purchased(let dto):
                onEntitlement(dto)
                markOwned(item.id)
                notice = .purchased(item.pack.title)
            case .pending:
                notice = .pending
            case .cancelled:
                break
            }
        } catch {
            notice = .failed
        }
    }

    func restore() async {
        guard buying == nil, !restoring else { return }
        restoring = true
        defer { restoring = false }
        do {
            let dto = try await service.restore()
            onEntitlement(dto)
            for id in dto.ownedProducts ?? [] { markOwned(id) }
            notice = (dto.ownedProducts ?? []).isEmpty && dto.tier == .free ? .nothingToRestore : .restored
        } catch PurchaseError.nothingToRestore {
            notice = .nothingToRestore
        } catch {
            notice = .failed
        }
    }

    private func markOwned(_ id: String) {
        items = items.map { item in
            guard item.id == id else { return item }
            var pack = item.pack
            pack.owned = true
            return Item(pack: pack, price: item.price)
        }
    }
}

/// Çocuk tarafı: sahip olunmayan paket içeriği gösterilmez (satın alma çocuğa önerilmez — Kids kategorisi).
enum PackVisibility {
    static func isVisible(_ item: LibraryItemDTO, ownedPacks: Set<String>) -> Bool {
        guard let pack = item.packId else { return true }
        return ownedPacks.contains(pack)
    }

    /// Ücretsiz kullanıcı için oynatılabilir mi (paketi aldıysa paket masalları serbest; haftalık hak harcamaz).
    static func isPlayableWithoutPremium(_ item: LibraryItemDTO, ownedPacks: Set<String>) -> Bool {
        if let pack = item.packId { return ownedPacks.contains(pack) }
        return item.isFree
    }
}
