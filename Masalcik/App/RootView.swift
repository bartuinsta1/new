import SwiftUI
import SwiftData

/// Kök yönlendirme. Onboarding tamamlanmamışsa onboarding, değilse Masal Adası.
/// Adım 1–2: henüz yalnızca iskelet ekranlar ve bileşen galerisi bağlı.
struct RootView: View {
    @Environment(AppState.self) private var appState
    @Query private var families: [Family]

    var body: some View {
        Group {
            if let family = families.first, family.hasCompletedOnboarding {
                WorldMapView()
            } else {
                OnboardingFlowView()
            }
        }
        .onReceive(Timer.publish(every: 60, on: .main, in: .common).autoconnect()) { _ in
            appState.refreshDisplayMode()
        }
    }
}

#Preview {
    RootView()
        .environment(AppState())
        .modelContainer(PersistenceController.preview.container)
}
