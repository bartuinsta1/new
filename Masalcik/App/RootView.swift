import SwiftUI
import SwiftData

/// Kök yönlendirme. Onboarding tamamlanmamışsa onboarding, değilse Masal Adası.
struct RootView: View {
    @Environment(AppState.self) private var appState
    @Query private var families: [Family]
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.modelContext) private var context

    var body: some View {
        Group {
            if let family = families.first, family.hasCompletedOnboarding {
                WorldMapView()
            } else {
                OnboardingFlowView()
            }
        }
        .task(id: families.first?.bedtime) {
            appState.bedtime = families.first?.bedtime ?? .default
        }
        .task { startPurchases() }
        // Her öne gelişte abonelik durumu sunucudan tazelenir (yenileme/iade/süre bitişi; istemci önbelleğine güvenilmez).
        .task(id: scenePhase) {
            guard scenePhase == .active, let family = families.first, family.hasCompletedOnboarding else { return }
            if let dto = try? await appState.api.verifyEntitlement(signedTransaction: nil) {
                EntitlementSync.apply(dto, to: family)
            }
        }
        .onReceive(Timer.publish(every: 60, on: .main, in: .common).autoconnect()) { _ in
            appState.refreshDisplayMode()
        }
    }
}

extension RootView {
    /// Uygulama dışında tamamlanan işlemler (yenileme, onaylanan "Satın Almadan Önce Sor") burada yakalanır.
    private func startPurchases() {
        guard let store = appState.purchases as? StoreKitPurchaseService else { return }
        store.onEntitlementChange = { [context] dto in
            if let family = try? context.fetch(FetchDescriptor<Family>()).first { EntitlementSync.apply(dto, to: family) }
        }
        store.startObservingTransactions()
    }
}

#Preview {
    RootView()
        .environment(AppState())
        .modelContainer(PersistenceController.preview.container)
}
