import SwiftUI
import Observation

/// Uygulama düzeyindeki gözlemlenebilir durum.
@MainActor
@Observable
final class AppState {
    /// Gündüz / Gece görsel modu. Uyku saatine göre otomatik hesaplanır, oynatıcı geçici olarak geceye zorlayabilir.
    var displayMode: DisplayMode
    /// Oynatıcı ya da "Bu Gece" akışı açıkken gece modu zorlanır.
    var forcesNight = false {
        didSet { refreshDisplayMode() }
    }
    var bedtime: Bedtime = .default {
        didSet { refreshDisplayMode() }
    }

    let api: StoryAPI

    init(api: StoryAPI = AppConfig.useMockBackend ? MockStoryAPI() : LiveStoryAPI()) {
        self.api = api
        self.displayMode = DisplayModeResolver.mode(for: .now, bedtime: .default)
    }

    func refreshDisplayMode(now: Date = .now) {
        displayMode = forcesNight ? .night : DisplayModeResolver.mode(for: now, bedtime: bedtime)
    }
}
