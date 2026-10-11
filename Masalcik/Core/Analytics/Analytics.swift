import Foundation

/// Birinci taraf, anonim, toplu analitik (§6). Üçüncü taraf SDK YOK.
/// Olaylar kişisel veri içermez (ad, yaş, metin yok); yalnızca olay adı + kaba sayısal/kategorik alanlar.
enum AnalyticsEvent: Sendable, Equatable {
    case onboardingStep(Int)
    case storyStarted(region: Region, mood: StoryMood, isLibrary: Bool)
    case storyFinished(durationSeconds: Int)
    case paywallShown
    case paywallClosed

    var name: String {
        switch self {
        case .onboardingStep: "onboarding_step"
        case .storyStarted: "story_started"
        case .storyFinished: "story_finished"
        case .paywallShown: "paywall_shown"
        case .paywallClosed: "paywall_closed"
        }
    }
}

@MainActor
final class Analytics {
    static let shared = Analytics()
    private(set) var buffer: [AnalyticsEvent] = []

    /// Olayları bellekte toplar; Adım 11'de kendi backend'imize toplu gönderim eklenecek.
    func track(_ event: AnalyticsEvent) {
        buffer.append(event)
    }

    /// Veri silmede gönderilmemiş olaylar da atılır.
    func clear() { buffer.removeAll() }
}
