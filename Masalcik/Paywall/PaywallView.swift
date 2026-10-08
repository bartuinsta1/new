import SwiftUI

/// Paywall (ebeveyn kapısı arkasında) — Adım 10. Şimdilik yer tutucu.
struct PaywallView: View {
    @Environment(\.theme) private var theme
    var body: some View {
        VStack(spacing: Metrics.spacingM) {
            CharacterView(character: .pamuk, mood: .sleepy, size: 140, isInteractive: false)
            Text(verbatim: "PaywallView").masalFont(.headline).foregroundStyle(theme.ink)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.background.ignoresSafeArea())
    }
}

#Preview { PaywallView().themed(.day) }
