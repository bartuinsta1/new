import Foundation

// MARK: - Backend sözleşmesi (şartname §4.1, §4.2, §5.2)
// JSON alan adları snake_case (convertToSnakeCase). Bu yüzden DTO alanlarında "URL/ID" yerine "Url/Id" yazılır;
// aksi halde `audio_url` → `audioUrl` dönüşümü `audioURL` ile eşleşmez. backend/shared/contract.ts ile birebir aynı tutun.

/// `POST /stories` gövdesi.
struct StoryRequest: Codable, Hashable, Sendable {
    var childName: String
    var childAge: Int
    var pronunciation: String?
    var interests: [Interest]
    var value: ValueTopic?
    var companionCharacter: CharacterID
    var region: Region
    var mood: StoryMood
    var durationMinutes: Int
    var recurringCharacters: [RecurringCharacterDTO]
    var recentStoryTitles: [String]
    var contentFilters: ContentFilters
    var voice: VoiceTone
    /// Masalın ve seslendirmenin dili (arayüz diliyle aynı).
    var language: AppLanguage
}

struct RecurringCharacterDTO: Codable, Hashable, Sendable {
    var name: String
    var card: String
}

struct CoverSceneDTO: Codable, Hashable, Sendable {
    var region: Region
    var timeOfDay: String
}

struct ParagraphDTO: Codable, Hashable, Sendable {
    var index: Int
    var text: String
    var sceneHint: String
    var emotion: ParagraphEmotion
    var audioUrl: URL?
}

/// LLM'in yapılandırılmış çıktısı + backend'in eklediği alanlar (id, ses URL'leri).
struct StoryDTO: Codable, Hashable, Sendable, Identifiable {
    var id: String
    var title: String
    var coverScene: CoverSceneDTO
    var characters: [CharacterID]
    var paragraphs: [ParagraphDTO]
    var moral: String?
    var newRecurringCharacter: RecurringCharacterDTO?
    var durationMinutes: Int
    var mood: StoryMood
    /// Moderasyon geçilemediyse backend güvenli bir kütüphane masalına düşer; istemci bunu bilir ama çocuğa göstermez.
    var isFallback: Bool
}

/// `POST /stories` akışlı yanıt olayları (NDJSON satırları).
enum StoryStreamEvent: Sendable, Equatable {
    /// Masal yazılırken ve güvenlik denetiminden geçerken birkaç saniyede bir gelir; bekleme animasyonu sürer.
    case progress(stage: String)
    /// Başlık ve kapak bilinir bilinmez gelir — bekleme animasyonu bunu gösterebilir.
    case started(id: String, title: String, coverScene: CoverSceneDTO)
    /// Her paragraf metni + sesi hazır olunca gelir; ilk paragraf hemen çalmaya başlar.
    case paragraph(ParagraphDTO)
    case completed(StoryDTO)
}

struct LibraryItemDTO: Codable, Hashable, Sendable, Identifiable {
    var id: String
    var title: String
    var region: Region
    var durationMinutes: Int
    var coverUrl: URL?
    /// Ücretsiz kullanıcının da açabileceği masal mı?
    var isFree: Bool
}

struct EntitlementDTO: Codable, Hashable, Sendable {
    var tier: Entitlement.Tier
    var productId: String?
    var expiresAt: Date?
    var isInTrial: Bool
    /// Bugün kalan ücretsiz kişisel masal (premium için nil).
    var personalStoriesRemainingToday: Int?
    var libraryStoriesRemainingThisWeek: Int?
}

struct VoiceCloneResponseDTO: Codable, Hashable, Sendable {
    var voiceId: String
    var status: String // "processing" | "ready"
}

enum APIError: Error, Equatable, Sendable {
    case dailyLimitReached
    /// Ücretsiz sürümde bu haftanın 3 kitaplık masalı açıldı (bu hafta açılanlar tekrar dinlenebilir).
    case weeklyLimitReached
    /// Bu kitaplık masalı yalnızca Premium'da.
    case premiumRequired
    /// Ad ya da telaffuz güvenlik filtresine takıldı: ebeveyn düzeltmeli (çocuğa gösterilmez).
    case unsafeInput
    case rateLimited
    case unauthorized
    case server(status: Int)
    case decoding
    case offline
}
