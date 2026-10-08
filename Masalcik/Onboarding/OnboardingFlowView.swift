import SwiftUI
import SwiftData

/// Onboarding akışı — Adım 4'te 6 adımlı gerçek akış (karşılama, ebeveyn kapısı, çocuk bilgisi, ilgi alanları,
/// değerler, avatar) yazılacak. Şimdilik karşılama + "geç" (geliştirme kolaylığı).
struct OnboardingFlowView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: Metrics.spacingL) {
            Spacer()
            CharacterView(character: .pamuk, mood: .sleepy, size: 200)
            VoicePromptPlayer(text: String(localized: "Merhaba! Ben Pamuk. Her gece sana özel bir masal anlatacağım."),
                              autoplay: true)
            Spacer()
            BubbleButton("Başlayalım", systemImage: "arrow.right", color: .grass, size: .large) {
                let family = Family(hasCompletedOnboarding: true)
                family.settings = AppSettings()
                family.entitlement = Entitlement()
                context.insert(family)
            }
            .padding(.bottom, Metrics.spacingXL)
        }
        .frame(maxWidth: .infinity)
        .background(theme.background.ignoresSafeArea())
    }
}
