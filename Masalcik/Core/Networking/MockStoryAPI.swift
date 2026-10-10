import Foundation

/// Sahte backend (Adım 1–4). Gerçek akış davranışını taklit eder: başlık hemen, paragraflar aralıklarla gelir.
/// Yanıtlar backend/supabase/functions/_shared/mock.ts ile aynı içeriktedir (Türkçe + İngilizce).
struct MockStoryAPI: StoryAPI {
    /// Paragraflar arası yapay gecikme. Testlerde 0 verilir.
    var paragraphDelay: Duration = .milliseconds(600)
    /// Kütüphane başlıklarının dili (gerçek API'de Accept-Language başlığı).
    var language: AppLanguage = .current

    func generateStory(_ request: StoryRequest, idempotencyKey: String) -> AsyncThrowingStream<StoryStreamEvent, Error> {
        let story = Self.sampleStory(for: request)
        let delay = paragraphDelay
        return AsyncThrowingStream { continuation in
            let task = Task {
                continuation.yield(.progress(stage: "writing"))
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
        var s = Self.sampleStory(for: Self.previewRequest(language: language))
        s.id = id
        return s
    }

    func library() async throws -> [LibraryItemDTO] { Self.sampleLibrary(language) }

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

    static func previewRequest(language: AppLanguage = .tr) -> StoryRequest {
        StoryRequest(
            childName: language == .tr ? "Ayşe" : "Emma", childAge: 5, pronunciation: nil, interests: [.animals],
            value: .sharing, companionCharacter: .findik, region: .whisperForest, mood: .calm, durationMinutes: 5,
            recurringCharacters: [], recentStoryTitles: [], contentFilters: .default, voice: .mother,
            language: language)
    }

    static func sampleStory(for r: StoryRequest) -> StoryDTO {
        let lang = r.language
        let name = r.childName
        let buddy = r.companionCharacter.displayName(in: lang)
        let place = r.region.locativeTitle(in: lang)
        let texts: [(String, ParagraphEmotion)]
        let title: String
        let moral: String
        let newCharacter: RecurringCharacterDTO
        switch lang {
        case .tr:
            title = "\(name) ve Kayıp Fener"
            moral = "Paylaşınca ışık çoğalır."
            newCharacter = RecurringCharacterDTO(name: "Fener Tavşan", card: "Küçük, beyaz, utangaç bir tavşan; elinde sarı bir fener taşır.")
            texts = [
                ("Bir varmış bir yokmuş, \(place) \(name) adında meraklı bir çocuk yaşarmış. En yakın arkadaşı \(buddy) her akşam onun penceresine gelirmiş.", .smiling),
                ("Bir akşam \(buddy) heyecanla gelmiş: \"\(name), ağaçların arasında küçük bir fener kaybolmuş! Onu bulursak bütün orman ışıl ışıl olacak.\"", .surprised),
                ("\(name) ile \(buddy) el ele vermişler. Yaprakların altına, çiçeklerin arkasına bakmışlar. Sonunda feneri bir sincap yuvasının yanında bulmuşlar.", .neutral),
                ("Fenerin sahibi küçük bir tavşanmış. Feneri ona uzatmışlar, tavşan da kocaman gülümsemiş. Paylaşınca ışık iki katına çıkmış.", .smiling),
                ("Orman yavaş yavaş sessizleşmiş. Ateş böcekleri tek tek yanmış. \(buddy) uzun uzun esnemiş.", .whisper),
                ("\(name) sıcacık battaniyesine sarılmış. Yıldızlar göz kırpmış. Gözleri yavaşça kapanmış.", .sleepy),
                ("Gökten üç elma düşmüş: biri \(TurkishText.dative(name)), biri \(TurkishText.dative(buddy)), biri de bu masalı dinleyen herkese. İyi geceler.", .sleepy),
            ]
        case .en:
            title = "\(name) and the Lost Lantern"
            moral = "When we share, the light grows."
            newCharacter = RecurringCharacterDTO(name: "Lantern Bunny", card: "A small, shy white bunny who carries a little yellow lantern.")
            texts = [
                ("Once upon a time, \(place), there lived a curious child named \(name). Every evening, \(buddy), the very best of friends, came to visit at the window.", .smiling),
                ("One evening \(buddy) arrived, all excited: \"\(name), a little lantern is lost among the trees! If we find it, the whole forest will sparkle.\"", .surprised),
                ("\(buddy) and \(name) set off hand in hand. They looked under the leaves and behind the flowers, and at last they found the lantern beside a squirrel's nest.", .neutral),
                ("The lantern belonged to a tiny bunny. They handed it back, and the bunny gave the biggest smile. When they shared, the light grew twice as bright.", .smiling),
                ("Little by little, the forest grew quiet. One by one, the fireflies lit up. \(buddy) gave a long, slow yawn.", .whisper),
                ("\(name) snuggled into a warm, cozy blanket. The stars winked. Sleepy eyes slowly closed.", .sleepy),
                ("Three apples fell from the sky: one for \(name), one for \(buddy), and one for everyone who listened to this story. Good night.", .sleepy),
            ]
        }
        return StoryDTO(
            id: "mock-\(UUID().uuidString.prefix(8))",
            title: title,
            coverScene: CoverSceneDTO(region: r.region, timeOfDay: "dusk"),
            characters: [.pamuk, r.companionCharacter],
            paragraphs: texts.enumerated().map { i, t in
                ParagraphDTO(index: i, text: t.0, sceneHint: "\(r.region.rawValue)_\(i)", emotion: t.1, audioUrl: nil)
            },
            moral: moral,
            newRecurringCharacter: newCharacter,
            durationMinutes: r.durationMinutes,
            mood: r.mood,
            isFallback: false)
    }

    static func sampleLibrary(_ lang: AppLanguage) -> [LibraryItemDTO] {
        let tr = lang == .tr
        return [
            .init(id: "lib-keloglan-1", title: tr ? "Keloğlan ile Sihirli Kaşık" : "Keloğlan and the Magic Spoon", region: .storytellerPlane, durationMinutes: 10, coverUrl: nil, isFree: true),
            .init(id: "lib-hoca-1", title: tr ? "Nasreddin Hoca ve Göldeki Ay" : "Nasreddin Hodja and the Moon in the Lake", region: .storytellerPlane, durationMinutes: 5, coverUrl: nil, isFree: true),
            .init(id: "lib-dedekorkut-1", title: tr ? "Dede Korkut'un Kopuzu" : "Dede Korkut's Lute", region: .storytellerPlane, durationMinutes: 15, coverUrl: nil, isFree: false),
            .init(id: "lib-forest-1", title: tr ? "Fındık'ın Kış Hazırlığı" : "Fındık Gets Ready for Winter", region: .whisperForest, durationMinutes: 10, coverUrl: nil, isFree: true),
            .init(id: "lib-forest-2", title: tr ? "Fısıldayan Yapraklar" : "The Whispering Leaves", region: .whisperForest, durationMinutes: 5, coverUrl: nil, isFree: false),
            .init(id: "lib-star-1", title: tr ? "Yıldız'ın İlk Gecesi" : "Yıldız's First Night", region: .starHill, durationMinutes: 15, coverUrl: nil, isFree: false),
            .init(id: "lib-star-2", title: tr ? "Teleskoptaki Göz Kırpan Ay" : "The Moon That Winked", region: .starHill, durationMinutes: 10, coverUrl: nil, isFree: true),
            .init(id: "lib-sea-1", title: tr ? "Kaptan Midye ve Şarkı Söyleyen Deniz" : "Captain Mussel and the Singing Sea", region: .lighthouseCove, durationMinutes: 10, coverUrl: nil, isFree: false),
            .init(id: "lib-sea-2", title: tr ? "Fenerin Uykucu Işığı" : "The Lighthouse's Sleepy Light", region: .lighthouseCove, durationMinutes: 5, coverUrl: nil, isFree: true),
            .init(id: "lib-feel-1", title: tr ? "Lodos Kardeşini Bekliyor" : "Lodos Waits for a Baby Sibling", region: .feelingsGarden, durationMinutes: 10, coverUrl: nil, isFree: false),
            .init(id: "lib-feel-2", title: tr ? "Karanlık Aslında Ne Renk?" : "What Colour Is the Dark, Really?", region: .feelingsGarden, durationMinutes: 10, coverUrl: nil, isFree: true),
            .init(id: "lib-home-1", title: tr ? "Pamuk'un Yumuşacık Yastığı" : "Pamuk's Fluffy Pillow", region: .sleepHouse, durationMinutes: 5, coverUrl: nil, isFree: true),
        ]
    }
}
