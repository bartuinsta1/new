import Foundation
import StoreKit

/// App Store Connect'teki abonelik ürünleri (tek abonelik grubu: "Masalcık Premium").
/// Fiyatlar App Store Connect'te: Aylık 79,99 TL, Yıllık 449,99 TL; ikisinde de 7 günlük ücretsiz deneme
/// (tanıtım teklifi). VARSAYIM: deneme her iki planda da var; Apple uygunluğu grup başına bir kez tanır.
enum PremiumProductID {
    static let monthly = "masalcik.premium.monthly"
    static let yearly = "masalcik.premium.yearly"
    static let all = [yearly, monthly]
}

/// Paywall'un gösterdiği ürün bilgisi (StoreKit `Product`'tan bağımsız: önizleme ve testler için).
struct PaywallProduct: Identifiable, Hashable, Sendable {
    enum Period: Hashable, Sendable { case month, year }

    var id: String
    var period: Period
    /// App Store'un yerel biçimli fiyatı ("₺449,99"). Fiyatı asla kendimiz yazmayız: App Store ne diyorsa o.
    var displayPrice: String
    var price: Decimal
    var currencyCode: String
    /// Bu kullanıcı ücretsiz denemeye uygunsa gün sayısı; değilse nil (deneme vaadi gösterilmez).
    var trialDays: Int?

    /// Yıllık planın aylık karşılığı (bilgi amaçlı, aşağı yuvarlanmaz).
    var monthlyEquivalent: String {
        let monthly = period == .year ? price / 12 : price
        return monthly.formatted(.currency(code: currencyCode))
    }
}

enum PurchaseResult: Equatable, Sendable {
    case purchased(EntitlementDTO)
    /// "Satın Almadan Önce Sor" (Aile Paylaşımı) ya da SCA onayı bekleniyor.
    case pending
    case cancelled
}

enum PurchaseError: Error, Equatable {
    case productNotFound
    case unverified
    case nothingToRestore
}

@MainActor
protocol PurchaseService: AnyObject {
    func products() async throws -> [PaywallProduct]
    func purchase(_ productID: String) async throws -> PurchaseResult
    /// "Satın alımları geri yükle": App Store ile eşitler, geçerli işlemleri sunucuda doğrular.
    func restore() async throws -> EntitlementDTO
    /// Masal Dükkanı paketlerinin App Store fiyatları (kimlik → yerel biçimli fiyat). Bulunamayan paket listede olmaz.
    func packPrices(_ ids: [String]) async throws -> [String: String]
}

/// StoreKit 2 + sunucu doğrulaması. Her işlem sunucuya JWS olarak gider (`/entitlements/verify`); sunucu Apple
/// imzasını doğrulamadan Premium açılmaz. İşlem ancak sunucu kabul ettikten sonra `finish()` edilir: ağ hatasında
/// StoreKit aynı işlemi `Transaction.updates` ile tekrar verir, ödeme kaybolmaz.
@MainActor
final class StoreKitPurchaseService: PurchaseService {
    private let api: StoryAPI
    private let accountToken: @Sendable () async -> UUID?
    private var loaded: [String: Product] = [:]
    private var updatesTask: Task<Void, Never>?

    /// Uygulama dışından gelen değişiklik (yenileme, iade, onaylanan bekleyen satın alma).
    var onEntitlementChange: (@MainActor (EntitlementDTO) -> Void)?

    init(api: StoryAPI, accountToken: @escaping @Sendable () async -> UUID?) {
        self.api = api
        self.accountToken = accountToken
    }

    func products() async throws -> [PaywallProduct] {
        let list = try await Product.products(for: PremiumProductID.all)
        var out: [PaywallProduct] = []
        for product in list {
            guard let sub = product.subscription else { continue }
            loaded[product.id] = product
            var trialDays: Int?
            if await sub.isEligibleForIntroOffer, let offer = sub.introductoryOffer, offer.paymentMode == .freeTrial {
                trialDays = Self.days(offer.period)
            }
            out.append(PaywallProduct(
                id: product.id,
                period: sub.subscriptionPeriod.unit == .year ? .year : .month,
                displayPrice: product.displayPrice,
                price: product.price,
                currencyCode: product.priceFormatStyle.currencyCode,
                trialDays: trialDays))
        }
        return out.sorted { $0.period == .year && $1.period != .year }
    }

    func purchase(_ productID: String) async throws -> PurchaseResult {
        guard let product = loaded[productID] else { throw PurchaseError.productNotFound }
        var options: Set<Product.PurchaseOption> = []
        if let token = await accountToken() { options.insert(.appAccountToken(token)) }
        switch try await product.purchase(options: options) {
        case .success(let verification):
            guard case .verified(let transaction) = verification else { throw PurchaseError.unverified }
            let dto = try await api.verifyEntitlement(signedTransaction: verification.jwsRepresentation)
            await transaction.finish()
            return .purchased(dto)
        case .pending:
            return .pending
        case .userCancelled:
            return .cancelled
        @unknown default:
            return .cancelled
        }
    }

    func restore() async throws -> EntitlementDTO {
        try await AppStore.sync()
        var signed: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified = result { signed.append(result.jwsRepresentation) }
        }
        guard !signed.isEmpty else { throw PurchaseError.nothingToRestore }
        return try await api.restoreEntitlements(signedTransactions: Array(signed.suffix(10)))
    }

    /// Uygulama açılışında bir kez: uygulama dışında tamamlanan işlemleri dinler.
    func startObservingTransactions() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard case .verified(let transaction) = result, let self else { continue }
                guard let dto = try? await self.api.verifyEntitlement(signedTransaction: result.jwsRepresentation) else {
                    continue // finish edilmez: bir sonraki açılışta tekrar gelir
                }
                await transaction.finish()
                self.onEntitlementChange?(dto)
            }
        }
    }

    func packPrices(_ ids: [String]) async throws -> [String: String] {
        let list = try await Product.products(for: ids)
        var out: [String: String] = [:]
        for product in list where product.type == .nonConsumable {
            loaded[product.id] = product
            out[product.id] = product.displayPrice
        }
        return out
    }

    static func days(_ period: Product.SubscriptionPeriod) -> Int {
        switch period.unit {
        case .day: period.value
        case .week: period.value * 7
        case .month: period.value * 30
        case .year: period.value * 365
        @unknown default: period.value
        }
    }
}

/// Önizleme, testler ve StoreKit yapılandırması olmayan geliştirme: App Store'a gitmeden sahte satın alma.
@MainActor
final class MockPurchaseService: PurchaseService {
    var api: StoryAPI
    var catalog: [PaywallProduct]
    var nextResult: Result<PurchaseResult, Error>?
    var restoreResult: Result<EntitlementDTO, Error>?
    private(set) var purchasedIDs: [String] = []

    init(api: StoryAPI = MockStoryAPI(), catalog: [PaywallProduct] = MockPurchaseService.turkishCatalog) {
        self.api = api
        self.catalog = catalog
    }

    func products() async throws -> [PaywallProduct] { catalog }

    func purchase(_ productID: String) async throws -> PurchaseResult {
        purchasedIDs.append(productID)
        if let nextResult { return try nextResult.get() }
        return .purchased(try await api.verifyEntitlement(signedTransaction: "mock-\(productID)-trial"))
    }

    func restore() async throws -> EntitlementDTO {
        if let restoreResult { return try restoreResult.get() }
        throw PurchaseError.nothingToRestore
    }

    var packPriceList: [String: String] = [
        "masalcik.pack.dedekorkut": "₺59,99", "masalcik.pack.space": "₺59,99", "masalcik.pack.outfits.bayram": "₺39,99",
    ]
    func packPrices(_ ids: [String]) async throws -> [String: String] { packPriceList.filter { ids.contains($0.key) } }

    static let turkishCatalog: [PaywallProduct] = [
        PaywallProduct(id: PremiumProductID.yearly, period: .year, displayPrice: "₺449,99", price: Decimal(string: "449.99")!,
                       currencyCode: "TRY", trialDays: 7),
        PaywallProduct(id: PremiumProductID.monthly, period: .month, displayPrice: "₺79,99", price: Decimal(string: "79.99")!,
                       currencyCode: "TRY", trialDays: 7),
    ]
}
