import SwiftUI

/// Masal Oynatıcı (Gece Modu) — Adım 6. Şimdilik yer tutucu.
struct StoryPlayerView: View {
    @Environment(\.theme) private var theme
    var body: some View {
        VStack(spacing: Metrics.spacingM) {
            CharacterView(character: .pamuk, mood: .sleepy, size: 140, isInteractive: false)
            Text(verbatim: "StoryPlayerView").masalFont(.headline).foregroundStyle(theme.ink)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.background.ignoresSafeArea())
    }
}

#Preview { StoryPlayerView().themed(.day) }
