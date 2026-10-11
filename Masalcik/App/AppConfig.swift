import Foundation

/// Uygulama genelindeki sabitler. Ürün adı yer tutucudur; tek yerden değiştirilir.
enum AppConfig {
    /// Uygulama adı (yer tutucu). Ekranlarda ve seslendirmelerde bu sabit kullanılır.
    static let appName = "Masalcık"

    /// Supabase proje adresi ve herkese açık "anon" anahtarı — Config.xcconfig → Info.plist.
    /// (Anon anahtar gizli değildir; asıl API anahtarları yalnızca sunucuda.) Boşsa uygulama sahte backend'le çalışır.
    static let supabaseURL: URL? = (Bundle.main.object(forInfoDictionaryKey: "MasalcikSupabaseURL") as? String)
        .flatMap { $0.isEmpty ? nil : URL(string: $0) }
    static let supabaseAnonKey: String = (Bundle.main.object(forInfoDictionaryKey: "MasalcikSupabaseAnonKey") as? String) ?? ""

    /// Edge Functions taban adresi.
    static var apiBaseURL: URL { (supabaseURL ?? URL(string: "https://example.supabase.co")!).appending(path: "functions/v1") }

    /// Supabase ayarlanmadıysa sahte (mock) backend: uygulama ağsız da uçtan uca çalışır.
    static var useMockBackend: Bool { supabaseURL == nil || supabaseAnonKey.isEmpty }

    /// Ücretsiz sürüm limitleri (şeffaf fiyatlandırma, bkz. şartname §1).
    /// Asıl uygulama backend'dedir; istemci yalnızca bilgi amaçlı gösterir.
    enum FreeTier {
        static let personalStoriesPerDay = 1
        static let libraryStoriesPerWeek = 3
    }

    /// KVKK aydınlatma metni ve gizlilik politikası (dile göre). Yalnızca ebeveyn kapısının arkasından açılır.
    /// VARSAYIM: Yer tutucu alan adı; lansmandan önce gerçek adresle değiştirilecek.
    static func privacyPolicyURL(_ lang: AppLanguage = .current) -> URL {
        URL(string: lang == .tr ? "https://masalcik.app/gizlilik" : "https://masalcik.app/en/privacy")!
    }

    /// Ebeveyn başına en fazla çocuk profili.
    static let maxChildProfiles = 4
    /// Onboarding'de seçilebilecek en fazla ilgi alanı.
    static let maxInterests = 5
}
