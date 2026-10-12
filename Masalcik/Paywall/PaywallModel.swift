import Foundation
import Observation

/// Paywall durumu (§3.9). Karanlık desen yok:
/// • kapatma her an mümkün (satın alma sürerken bile; StoreKit sayfası kendi iptaline sahip),
/// • geri sayım, sahte indirim, "son şans", önceden seçili ek ürün yok,
/// • fiyat, yenileme dönemi ve deneme bitiş tarihi düğmenin hemen altında, aynı punto ile.
/// VARSAYIM: "En avantajlı" rozetli yıllık plan başlangıçta seçili; iki planın fiyatı da açıkça görünür.
@MainActor
@Observable
final class PaywallModel {
    enum Phase: Equatable {
        case loading
        case ready
        /// Fiyatlar yüklenemedi (çevrimdışı ya da ürünler App Store'da yok). Geri yükleme yine de çalışır.
        case unavailable
        case purchasing
        case restoring
        case pending
        case purchased
    }

    enum Notice: Equatable {
        case purchaseFailed
        case nothingToRestore
        case restoreFailed
        case restored
    }

    private(set) var phase: Phase = .loading
    var notice: Notice?
    private(set) var products: [PaywallProduct] = []
    var selectedID: String?

    private let service: PurchaseService
    private let onEntitlement: @MainActor (EntitlementDTO) -> Void
    private let now: () -> Date
    private let calendar: Calendar

    init(service: PurchaseService, now: @escaping () -> Date = { .now }, calendar: Calendar = .current,
         onEntitlement: @escaping @MainActor (EntitlementDTO) -> Void = { _ in }) {
        self.service = service
        self.now = now
        self.calendar = calendar
        self.onEntitlement = onEntitlement
    }

    var selected: PaywallProduct? { products.first { $0.id == selectedID } }
    var yearly: PaywallProduct? { products.first { $0.period == .year } }
    var monthly: PaywallProduct? { products.first { $0.period == .month } }
    var isBusy: Bool { phase == .purchasing || phase == .restoring }

    /// Yıllık planın, 12 ay aylık ödemeye göre ne kadar daha uygun olduğu (aşağı yuvarlanır: abartı yok).
    var yearlySavingsPercent: Int? {
        guard let m = monthly, let y = yearly, m.price > 0 else { return nil }
        let ratio = NSDecimalNumber(decimal: y.price / (m.price * 12)).doubleValue
        let percent = Int(((1 - ratio) * 100).rounded(.down))
        return percent > 0 ? percent : nil
    }

    /// Seçili planın ücretsiz denemesi bugün başlasa ne zaman biter (Apple: satın alma anı + deneme süresi).
    var trialEndDate: Date? {
        guard let days = selected?.trialDays else { return nil }
        return calendar.date(byAdding: .day, value: days, to: now())
    }

    func load() async {
        phase = .loading
        do {
            products = try await service.products()
            if selectedID == nil || selected == nil { selectedID = (yearly ?? products.first)?.id }
            phase = products.isEmpty ? .unavailable : .ready
        } catch {
            phase = .unavailable
        }
    }

    func select(_ product: PaywallProduct) {
        guard !isBusy else { return }
        selectedID = product.id
    }

    func purchase() async {
        guard let id = selectedID, phase == .ready else { return }
        phase = .purchasing
        do {
            switch try await service.purchase(id) {
            case .purchased(let dto):
                onEntitlement(dto)
                phase = .purchased
                Analytics.shared.track(.paywallPurchased(yearly: id == PremiumProductID.yearly))
            case .pending:
                phase = .pending
            case .cancelled:
                phase = .ready
            }
        } catch {
            notice = .purchaseFailed
            phase = .ready
        }
    }

    func restore() async {
        guard !isBusy else { return }
        let previous = phase
        phase = .restoring
        do {
            let dto = try await service.restore()
            onEntitlement(dto)
            if dto.tier == .premium {
                phase = .purchased
                notice = .restored
            } else {
                phase = previous
                notice = .nothingToRestore
            }
        } catch PurchaseError.nothingToRestore {
            phase = previous
            notice = .nothingToRestore
        } catch {
            phase = previous
            notice = .restoreFailed
        }
    }
}

/// Paywall ne zaman önerilebilir (§3.1, §3.9): onboarding sonunda asla; ancak ilk masal dinlendikten sonra
/// ve her zaman ebeveyn kapısının arkasında. Ebeveyn Köşesi > Hesap'tan ebeveyn kendisi her zaman açabilir.
enum PaywallPolicy {
    static func canOffer(family: Family?) -> Bool {
        guard let family, family.hasCompletedOnboarding, family.entitlement?.isPremium != true else { return false }
        return family.children.contains { $0.listenedStoryCount > 0 }
    }
}
