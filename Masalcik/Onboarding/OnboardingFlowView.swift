import SwiftUI
import SwiftData

/// Onboarding akışı (§3.1): en fazla 6 adım, ebeveynle birlikte. Sonunda paywall yok; doğrudan ilk masal.
struct OnboardingFlowView: View {
    @Environment(\.modelContext) private var context
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.theme) private var theme
    @State private var model = OnboardingModel()
    @State private var hasEntered = false

    var body: some View {
        ZStack {
            Group {
                switch model.step {
                case .welcome: WelcomeStepView(model: model)
                case .parentGate: ParentGateStepView(model: model)
                case .parentInfo: ParentInfoStepView(model: model)
                case .childInfo: ChildInfoStepView(model: model)
                case .interests: InterestsStepView(model: model)
                case .values: ValuesStepView(model: model)
                case .avatar: AvatarStepView(model: model)
                case .finale: OnboardingFinaleView(model: model, onEnter: enterIsland)
                }
            }
            .id(model.step)
            .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                    removal: .move(edge: .leading).combined(with: .opacity)))
        }
        .animation(Motion.standard(theme.mode, reduceMotion: reduceMotion), value: model.step)
    }

    private func enterIsland() {
        guard !hasEntered else { return }
        hasEntered = true
        appState.opensTonightOnNextMapAppear = true
        appState.bedtime = model.bedtime
        model.enterIsland(in: context)
    }
}

#Preview("Onboarding") {
    OnboardingFlowView()
        .environment(AppState())
        .modelContainer(PersistenceController(inMemory: true).container)
        .themed(.day)
}
