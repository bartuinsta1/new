import SwiftUI
import SwiftData

@main
struct MasalcikApp: App {
    @State private var appState = LaunchOptions.isUITesting ? AppState.uiTesting() : AppState()
    private let persistence = LaunchOptions.isUITesting
        ? PersistenceController.uiTesting(LaunchOptions.uiState) : PersistenceController.shared

    init() {
        if LaunchOptions.isUITesting { UIView.setAnimationsEnabled(false) }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .themed(appState.displayMode)
        }
        .modelContainer(persistence.container)
    }
}
