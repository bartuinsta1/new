import SwiftUI

/// Hazine Sandığı — Adım 8. Şimdilik yer tutucu.
struct TreasureChestView: View {
    @Environment(\.theme) private var theme
    var body: some View {
        VStack(spacing: Metrics.spacingM) {
            CharacterView(character: .pamuk, mood: .sleepy, size: 140, isInteractive: false)
            Text(verbatim: "TreasureChestView").masalFont(.headline).foregroundStyle(theme.ink)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.background.ignoresSafeArea())
    }
}

#Preview { TreasureChestView().themed(.day) }
