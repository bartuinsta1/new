import Foundation
import SwiftData

/// UI testleri için başlatma bayrakları. Yalnızca DEBUG derlemede okunur: App Store sürümünde bayraklarla
/// ebeveyn kapısı ya da satın alma atlatılamaz.
///
///   -uiTesting                      bellek içi depo, sahte backend, sahte satın alma, animasyonsuz
///   -uiTestingState <durum>         onboarding | freeAfterFirstStory (varsayılan) | premium
///   -parentGateAnswer <sayı>        ebeveyn kapısı sorusu sabit (ör. 63)
enum LaunchOptions {
    #if DEBUG
    private static let arguments = ProcessInfo.processInfo.arguments
    #else
    private static let arguments: [String] = []
    #endif

    static var isUITesting: Bool { arguments.contains("-uiTesting") }

    enum UIState: String {
        case onboarding, freeAfterFirstStory, premium
    }

    static var uiState: UIState { value(after: "-uiTestingState").flatMap(UIState.init) ?? .freeAfterFirstStory }

    static var fixedGateAnswer: Int? { value(after: "-parentGateAnswer").flatMap(Int.init) }

    private static func value(after flag: String) -> String? {
        guard let i = arguments.firstIndex(of: flag), arguments.indices.contains(i + 1) else { return nil }
        return arguments[i + 1]
    }
}

extension PersistenceController {
    /// UI testlerinin başladığı durum (bellek içi).
    static func uiTesting(_ state: LaunchOptions.UIState) -> PersistenceController {
        let controller = PersistenceController(inMemory: true, seed: state != .onboarding)
        guard state != .onboarding,
              let family = try? controller.container.mainContext.fetch(FetchDescriptor<Family>()).first else { return controller }
        // İlk masal dinlenmiş: Paywall önerilebilir (§3.9).
        family.children.first?.stories.first?.playCount = 1
        if state == .premium {
            family.entitlement = Entitlement(tier: .premium, productID: PremiumProductID.yearly,
                                             expiresAt: .now.addingTimeInterval(30 * 86_400))
        }
        return controller
    }
}

extension AppState {
    static func uiTesting() -> AppState {
        AppState(services: (MockStoryAPI(), nil), purchases: MockPurchaseService())
    }
}
