import Foundation

/// Birinci taraf, anonim, toplu analitik (§6). Üçüncü taraf SDK YOK.
/// Olaylar kişisel veri içermez (ad, yaş, metin yok); yalnızca olay adı + kaba sayısal/kategorik alanlar.
enum AnalyticsEvent: Sendable, Equatable {
    case onboardingStep(Int)
    case storyStarted(region: Region, mood: StoryMood, isLibrary: Bool)
    case storyFinished(durationSeconds: Int)
    case paywallShown
    case paywallClosed
    /// Yalnızca plan türü (aylık/yıllık); fiyat ya da kullanıcı bilgisi yok.
    case paywallPurchased(yearly: Bool)

    var name: String {
        switch self {
        case .onboardingStep: "onboarding_step"
        case .storyStarted: "story_started"
        case .storyFinished: "story_finished"
        case .paywallShown: "paywall_shown"
        case .paywallClosed: "paywall_closed"
        case .paywallPurchased: "paywall_purchased"
        }
    }
}

extension AnalyticsEvent {
    /// Sunucuya giden biçim (`POST /events`). Sunucu yalnızca bu adları ve boyutları kabul eder
    /// (backend/supabase/functions/_shared/analytics.ts — ikisi birlikte güncellenir).
    var dto: AnalyticsEventDTO {
        switch self {
        case .onboardingStep(let step):
            AnalyticsEventDTO(name: name, dims: ["step": .int(step)])
        case .storyStarted(let region, let mood, let isLibrary):
            AnalyticsEventDTO(name: name, dims: ["region": .string(region.rawValue), "mood": .string(mood.rawValue),
                                                 "library": .bool(isLibrary)])
        case .storyFinished(let seconds):
            // Kesin süre değil, kaba aralık: tek bir çocuğun alışkanlığı izlenemesin.
            AnalyticsEventDTO(name: name, dims: ["minutes": .string(Self.minutesBucket(seconds))])
        case .paywallShown, .paywallClosed:
            AnalyticsEventDTO(name: name, dims: [:])
        case .paywallPurchased(let yearly):
            AnalyticsEventDTO(name: name, dims: ["plan": .string(yearly ? "yearly" : "monthly")])
        }
    }

    static func minutesBucket(_ seconds: Int) -> String {
        switch seconds / 60 {
        case ..<5: "0-5"
        case ..<10: "5-10"
        case ..<15: "10-15"
        default: "15+"
        }
    }
}

/// Olaylar cihazda biriktirilir ve toplu gönderilir: uygulama arka plana geçince ya da 20 olay birikince.
/// Gönderilemeyenler saklanır (en çok 200; en eskiler atılır). Kimlik, cihaz bilgisi ya da zaman damgası gönderilmez.
@MainActor
final class Analytics {
    static let shared = Analytics()
    static let batchSize = 20
    static let maxPending = 200
    private static let storageKey = "masalcik.analytics.pending"

    private(set) var buffer: [AnalyticsEventDTO]
    private let defaults: UserDefaults
    private var flushing = false
    /// Gönderim için API (uygulama açılışında atanır). Yoksa olaylar yalnızca birikir.
    var api: StoryAPI?

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: Self.storageKey),
           let saved = try? JSONDecoder().decode([AnalyticsEventDTO].self, from: data) {
            buffer = saved
        } else {
            buffer = []
        }
    }

    func track(_ event: AnalyticsEvent) {
        buffer.append(event.dto)
        if buffer.count > Self.maxPending { buffer.removeFirst(buffer.count - Self.maxPending) }
        persist()
        if buffer.count >= Self.batchSize { Task { await flush() } }
    }

    /// Biriken olayları gönderir; başarısızsa saklar, sonra yeniden dener.
    func flush() async {
        guard let api, !flushing, !buffer.isEmpty else { return }
        flushing = true
        defer { flushing = false }
        let batch = Array(buffer.prefix(50))
        do {
            try await api.sendEvents(batch)
            buffer.removeFirst(min(batch.count, buffer.count))
            persist()
        } catch {
            // Çevrimdışı: bir sonraki fırsatta.
        }
    }

    /// Veri silmede gönderilmemiş olaylar da atılır.
    func clear() {
        buffer.removeAll()
        defaults.removeObject(forKey: Self.storageKey)
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(buffer) { defaults.set(data, forKey: Self.storageKey) }
    }
}
