import SwiftUI

/// "Bu Gece" akışı — Adım 7. Şimdilik yer tutucu.
struct TonightFlowView: View {
    @Environment(\.theme) private var theme
    var body: some View {
        VStack(spacing: Metrics.spacingM) {
            CharacterView(character: .pamuk, mood: .sleepy, size: 140, isInteractive: false)
            Text(verbatim: "TonightFlowView").masalFont(.headline).foregroundStyle(theme.ink)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.background.ignoresSafeArea())
    }
}

#Preview { TonightFlowView().themed(.day) }
