import Foundation

/// Sahte backend (Adım 1–4). Gerçek akış davranışını taklit eder: başlık hemen, paragraflar aralıklarla gelir.
/// Yanıtlar backend/supabase/functions/_shared/mock.ts ile aynı içeriktedir.
struct MockStoryAPI: StoryAPI {
    /// Paragraflar arası yapay gecikme. Testlerde 0 verilir.
    var paragraphDelay: Duration = .milliseconds(600)

    func generateStory(_ request: StoryRequest) -> AsyncThrowingStream<StoryStreamEvent, Error> {
        let story = Self.sampleStory(for: request)
        let delay = paragraphDelay
        return AsyncThrowingStream { continuation in
            let task = Task {
                continuation.yield(.started(id: story.id, title: story.title, coverScene: story.coverScene))
                for paragraph in story.paragraphs {
                    if delay > .zero { try? await Task.sleep(for: delay) }
                    if Task.isCancelled { break }
                    continuation.yield(.paragraph(paragraph))
                }
                continuation.yield(.completed(story))
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func story(id: String) async throws -> StoryDTO {
        var s = Self.sampleStory(for: Self.previewRequest)
        s.id = id
        return s
    }

    func library() async throws -> [LibraryItemDTO] { Self.sampleLibrary }

    func createVoiceClone(sample: Data, consentedAt: Date) async throws -> VoiceCloneResponseDTO {
        VoiceCloneResponseDTO(voiceId: "mock-voice", status: "processing")
    }

    func deleteVoiceClone() async throws {}

    func verifyEntitlement(signedTransaction: String?) async throws -> EntitlementDTO {
        if signedTransaction != nil {
            return EntitlementDTO(tier: .premium, productId: "masalcik.premium.yearly",
                                  expiresAt: .now.addingTimeInterval(7 * 86_400), isInTrial: true,
                                  personalStoriesRemainingToday: nil, libraryStoriesRemainingThisWeek: nil)
        }
        return EntitlementDTO(tier: .free, productId: nil, expiresAt: nil, isInTrial: false,
                              personalStoriesRemainingToday: AppConfig.FreeTier.personalStoriesPerDay,
                              libraryStoriesRemainingThisWeek: AppConfig.FreeTier.libraryStoriesPerWeek)
    }

    func deleteAccount() async throws {}

    // MARK: - Örnek içerik

    static let previewRequest = StoryRequest(
        childName: "Ayşe", childAge: 5, pronunciation: nil, interests: [.animals], value: .sharing,
        companionCharacter: .findik, region: .whisperForest, mood: .calm, durationMinutes: 5,
        recurringCharacters: [], recentStoryTitles: [], contentFilters: .default, voice: .mother)

    static func sampleStory(for r: StoryRequest) -> StoryDTO {
        let name = r.childName
        let buddy = r.companionCharacter.displayName
        let place = r.region.locativeTitle
        let texts: [(String, ParagraphEmotion)] = [
            ("Bir varmış bir yokmuş, \(place) \(name) adında meraklı bir çocuk yaşarmış. En yakın arkadaşı \(buddy) her akşam onun penceresine gelirmiş.", .smiling),
            ("Bir akşam \(buddy) heyecanla gelmiş: \"\(name), ağaçların arasında küçük bir fener kaybolmuş! Onu bulursak bütün orman ışıl ışıl olacak.\"", .surprised),
            ("\(name) ile \(buddy) el ele vermişler. Yaprakların altına, çiçeklerin arkasına bakmışlar. Sonunda feneri bir sincap yuvasının yanında bulmuşlar.", .neutral),
            ("Fenerin sahibi küçük bir tavşanmış. Feneri ona uzatmışlar, tavşan da kocaman gülümsemiş. Paylaşınca ışık iki katına çıkmış.", .smiling),
            ("Orman yavaş yavaş sessizleşmiş. Ateş böcekleri tek tek yanmış. \(buddy) uzun uzun esnemiş.", .whisper),
            ("\(name) sıcacık battaniyesine sarılmış. Yıldızlar göz kırpmış. Gözleri yavaşça kapanmış.", .sleepy),
            ("Gökten üç elma düşmüş: biri \(TurkishText.dative(name)), biri \(TurkishText.dative(buddy)), biri de bu masalı dinleyen herkese. İyi geceler.", .sleepy),
        ]
        return StoryDTO(
            id: "mock-\(UUID().uuidString.prefix(8))",
            title: "\(name) ve Kayıp Fener",
            coverScene: CoverSceneDTO(region: r.region, timeOfDay: "dusk"),
            characters: [.pamuk, r.companionCharacter],
            paragraphs: texts.enumerated().map { i, t in
                ParagraphDTO(index: i, text: t.0, sceneHint: "\(r.region.rawValue)_\(i)", emotion: t.1, audioUrl: nil)
            },
            moral: "Paylaşınca ışık çoğalır.",
            newRecurringCharacter: RecurringCharacterDTO(name: "Fener Tavşan", card: "Küçük, beyaz, utangaç bir tavşan; elinde sarı bir fener taşır."),
            durationMinutes: r.durationMinutes,
            mood: r.mood,
            isFallback: false)
    }

    static let sampleLibrary: [LibraryItemDTO] = [
        .init(id: "lib-keloglan-1", title: "Keloğlan ile Sihirli Kaşık", region: .storytellerPlane, durationMinutes: 10, coverUrl: nil, isFree: true),
        .init(id: "lib-hoca-1", title: "Nasreddin Hoca ve Göldeki Ay", region: .storytellerPlane, durationMinutes: 5, coverUrl: nil, isFree: true),
        .init(id: "lib-forest-1", title: "Fındık'ın Kış Hazırlığı", region: .whisperForest, durationMinutes: 10, coverUrl: nil, isFree: true),
        .init(id: "lib-star-1", title: "Yıldız'ın İlk Gecesi", region: .starHill, durationMinutes: 15, coverUrl: nil, isFree: false),
        .init(id: "lib-sea-1", title: "Kaptan Midye ve Şarkı Söyleyen Deniz", region: .lighthouseCove, durationMinutes: 10, coverUrl: nil, isFree: false),
        .init(id: "lib-feel-1", title: "Lodos Kardeşini Bekliyor", region: .feelingsGarden, durationMinutes: 10, coverUrl: nil, isFree: false),
    ]
}
