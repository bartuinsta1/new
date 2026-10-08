import SwiftUI

/// Ebeveyn Köşesi (3 sekme) — Adım 9. Şimdilik yer tutucu.
struct ParentZoneView: View {
    @Environment(\.theme) private var theme
    var body: some View {
        VStack(spacing: Metrics.spacingM) {
            CharacterView(character: .pamuk, mood: .sleepy, size: 140, isInteractive: false)
            Text(verbatim: "ParentZoneView").masalFont(.headline).foregroundStyle(theme.ink)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.background.ignoresSafeArea())
    }
}

#Preview { ParentZoneView().themed(.day) }
