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
    /// Masal Dükkanı paketine aitse paket kimliği: yalnızca paketi alan açar (Premium'a dahil değil).
    var packId: String? = nil
}

/// `GET /library/packs` — Masal Dükkanı paketi (fiyat App Store'dan gelir).
struct PackDTO: Codable, Hashable, Sendable, Identifiable {
    enum Kind: String, Codable, Sendable { case stories, outfits }
    struct StoryItem: Codable, Hashable, Sendable, Identifiable {
        var id: String
        var title: String
        var region: Region
        var durationMinutes: Int
    }
    var id: String
    var kind: Kind
    var title: String
    var description: String
    var owned: Bool
    var stories: [StoryItem]
    /// `Outfit.key` değerleri.
    var outfits: [String]
}

struct EntitlementDTO: Codable, Hashable, Sendable {
    var tier: Entitlement.Tier
    var productId: String?
    var expiresAt: Date?
    var isInTrial: Bool
    /// Bugün kalan ücretsiz kişisel masal (premium için nil).
    var personalStoriesRemainingToday: Int?
    var libraryStoriesRemainingThisWeek: Int?
    /// Sahip olunan tek seferlik paketler (Masal Dükkanı). nil: sunucu bildirmedi (eski yanıt), yerel kayıt korunur.
    var ownedProducts: [String]? = nil
}

/// `POST /events` öğesi: olay adı + kaba boyutlar (kimlik yok).
struct AnalyticsEventDTO: Codable, Hashable, Sendable {
    enum Value: Codable, Hashable, Sendable {
        case string(String), int(Int), bool(Bool)

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let b = try? c.decode(Bool.self) { self = .bool(b) }
            else if let i = try? c.decode(Int.self) { self = .int(i) }
            else { self = .string(try c.decode(String.self)) }
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.singleValueContainer()
            switch self {
            case .string(let s): try c.encode(s)
            case .int(let i): try c.encode(i)
            case .bool(let b): try c.encode(b)
            }
        }
    }
    var name: String
    var dims: [String: Value]
}

/// `GET /referral`
struct ReferralDTO: Codable, Hashable, Sendable {
    var code: String
    var rewardsThisYear: Int
    var rewardDays: Int
}

/// `POST /referral/redeem`
struct ReferralRedeemDTO: Codable, Hashable, Sendable {
    var premiumUntil: Date
    var inviterRewarded: Bool
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
    /// Bu kitaplık masalı bir Masal Dükkanı paketinde; paket alınmamış.
    case packRequired
    /// Davet kodu kullanılamadı: invalid_code | own_code | already_redeemed
    case referralRejected(String)
    /// Ad ya da telaffuz güvenlik filtresine takıldı: ebeveyn düzeltmeli (çocuğa gösterilmez).
    case unsafeInput
    case rateLimited
    case unauthorized
    case server(status: Int)
    case decoding
    case offline
}
