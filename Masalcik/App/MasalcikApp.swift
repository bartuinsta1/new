import SwiftUI
import SwiftData

@main
struct MasalcikApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .themed(appState.displayMode)
        }
        .modelContainer(PersistenceController.shared.container)
    }
}
