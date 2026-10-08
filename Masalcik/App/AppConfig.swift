import Foundation

/// Uygulama genelindeki sabitler. Ürün adı yer tutucudur; tek yerden değiştirilir.
enum AppConfig {
    /// Uygulama adı (yer tutucu). Ekranlarda ve seslendirmelerde bu sabit kullanılır.
    static let appName = "Masalcık"

    /// Backend taban adresi.
    /// VARSAYIM: Supabase Edge Functions kullanıyoruz; gerçek proje URL'si Config.xcconfig'den gelecek.
    static let apiBaseURL = URL(string: "https://example.supabase.co/functions/v1")!

    /// `true` iken ağ katmanı sahte (mock) yanıtlar döner. Adım 5'e kadar açık kalacak.
    static let useMockBackend = true

    /// Ücretsiz sürüm limitleri (şeffaf fiyatlandırma, bkz. şartname §1).
    /// Asıl uygulama backend'dedir; istemci yalnızca bilgi amaçlı gösterir.
    enum FreeTier {
        static let personalStoriesPerDay = 1
        static let libraryStoriesPerWeek = 3
    }

    /// Ebeveyn başına en fazla çocuk profili.
    static let maxChildProfiles = 4
    /// Onboarding'de seçilebilecek en fazla ilgi alanı.
    static let maxInterests = 5
}
