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
    /// Anonim oturum (gerçek backend'de). Veri silmede jetonlar da silinir.
    let auth: AuthSession?

    /// Onboarding bittiğinde haritaya geçilir ve "Bu Gece" akışı doğrudan açılır (§3.1 adım 6: "ardından doğrudan ilk masal").
    var opensTonightOnNextMapAppear = false

    init(services: (api: StoryAPI, auth: AuthSession?) = AppState.makeServices()) {
        self.api = services.api
        self.auth = services.auth
        self.displayMode = DisplayModeResolver.mode(for: .now, bedtime: .default)
    }

    convenience init(api: StoryAPI) { self.init(services: (api, nil)) }

    /// Supabase ayarlıysa gerçek backend (anonim hesapla), değilse sahte backend.
    nonisolated static func makeServices() -> (api: StoryAPI, auth: AuthSession?) {
        guard !AppConfig.useMockBackend, let url = AppConfig.supabaseURL else { return (MockStoryAPI(), nil) }
        let auth = AuthSession(baseURL: url, anonKey: AppConfig.supabaseAnonKey)
        let api = LiveStoryAPI(baseURL: AppConfig.apiBaseURL, anonKey: AppConfig.supabaseAnonKey,
                               accessToken: { await auth.accessToken() })
        return (api, auth)
    }

    func refreshDisplayMode(now: Date = .now) {
        displayMode = forcesNight ? .night : DisplayModeResolver.mode(for: now, bedtime: bedtime)
    }
}
