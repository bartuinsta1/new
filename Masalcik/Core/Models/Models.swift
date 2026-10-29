import Foundation
import SwiftData

// MARK: - SwiftData modelleri (şartname §5.3)
// Veri minimizasyonu (KVKK/COPPA): çocuk için yalnızca ad, yaş, ilgi alanları,
// değerler, telaffuz ve avatar tutulur. Doğum tarihi, fotoğraf, konum YOK.

@Model
final class Family {
    @Attribute(.unique) var id: UUID
    /// Backend'deki anonim kullanıcı kimliği (cihaza bağlı). Apple ile Giriş isteğe bağlıdır.
    var remoteUserID: String?
    var createdAt: Date
    var hasCompletedOnboarding: Bool
    var bedtime: Bedtime
    /// Onboarding'de söylenen çocuk sayısı (1…4). Ebeveyn Köşesi eksik profilleri eklemeyi hatırlatır.
    var expectedChildCount: Int = 1
    /// Uygulamanın şu an kimin için çalıştığı (ebeveyn Ebeveyn Köşesi'nden değiştirir).
    var activeChildID: UUID?

    @Relationship(deleteRule: .cascade, inverse: \ChildProfile.family)
    var children: [ChildProfile] = []

    @Relationship(deleteRule: .cascade)
    var settings: AppSettings?

    @Relationship(deleteRule: .cascade)
    var entitlement: Entitlement?

    init(id: UUID = UUID(), remoteUserID: String? = nil, createdAt: Date = .now,
         hasCompletedOnboarding: Bool = false, bedtime: Bedtime = .default) {
        self.id = id
        self.remoteUserID = remoteUserID
        self.createdAt = createdAt
        self.hasCompletedOnboarding = hasCompletedOnboarding
        self.bedtime = bedtime
    }
}

extension Family {
    /// Sıralı profiller (ilk eklenen önce).
    var orderedChildren: [ChildProfile] { children.sorted { $0.createdAt < $1.createdAt } }

    /// Aktif çocuk; seçilmemişse ya da silinmişse ilk profil.
    var activeChild: ChildProfile? {
        orderedChildren.first { $0.id == activeChildID } ?? orderedChildren.first
    }

    var canAddChild: Bool { children.count < AppConfig.maxChildProfiles }
}

@Model
final class ChildProfile {
    @Attribute(.unique) var id: UUID
    var name: String
    var age: Int
    /// Ebeveynin girdiği fonetik yazım (ör. "Ayşe" → "Ay-şe"). Boşsa ad olduğu gibi okunur.
    var pronunciation: String?
    var interests: [Interest]
    var values: [ValueTopic]
    var avatar: AvatarConfig
    var companion: CharacterID
    /// Masal dinlenen geceler ("2026-10-11"; gece yarısından sonraki masal önceki geceye sayılır).
    var listeningNights: [String] = []
    /// Karakterlere giydirilen kıyafetler: karakter → kıyafet anahtarı.
    var equippedOutfits: [String: String] = [:]
    /// Masalın bittiği anlar: haftalık özette "tahmini uykuya dalma saati" (§3.7).
    var storyEndTimes: [Date] = []
    var createdAt: Date

    var family: Family?

    @Relationship(deleteRule: .cascade, inverse: \Story.child)
    var stories: [Story] = []

    @Relationship(deleteRule: .cascade, inverse: \RecurringCharacter.child)
    var recurringCharacters: [RecurringCharacter] = []

    @Relationship(deleteRule: .cascade, inverse: \Sticker.child)
    var stickers: [Sticker] = []

    init(id: UUID = UUID(), name: String, age: Int, pronunciation: String? = nil,
         interests: [Interest] = [], values: [ValueTopic] = [],
         avatar: AvatarConfig = .default, companion: CharacterID = .pamuk, createdAt: Date = .now) {
        self.id = id
        self.name = name
        self.age = age
        self.pronunciation = pronunciation
        self.interests = interests
        self.values = values
        self.avatar = avatar
        self.companion = companion
        self.createdAt = createdAt
    }

    /// TTS'e verilecek ad: fonetik yazım varsa o.
    var spokenName: String {
        if let p = pronunciation?.trimmingCharacters(in: .whitespacesAndNewlines), !p.isEmpty { return p }
        return name
    }
}

@Model
final class Story {
    /// Backend masal kimliği (kişisel masal) ya da kütüphane masalı kimliği.
    @Attribute(.unique) var id: String
    var title: String
    var region: Region
    var timeOfDay: String
    var mood: StoryMood
    var characters: [CharacterID]
    var moral: String?
    var durationMinutes: Int
    var isLibraryStory: Bool
    var isFavorite: Bool
    var createdAt: Date
    var lastPlayedAt: Date?
    var playCount: Int
    /// Kapak görseli (CDN) — yoksa bölge illüstrasyonu kullanılır.
    var coverURL: URL?

    var child: ChildProfile?

    @Relationship(deleteRule: .cascade, inverse: \StoryParagraph.story)
    var paragraphs: [StoryParagraph] = []

    init(id: String, title: String, region: Region, timeOfDay: String = "night", mood: StoryMood,
         characters: [CharacterID], moral: String? = nil, durationMinutes: Int,
         isLibraryStory: Bool = false, isFavorite: Bool = false, createdAt: Date = .now,
         lastPlayedAt: Date? = nil, playCount: Int = 0, coverURL: URL? = nil) {
        self.id = id
        self.title = title
        self.region = region
        self.timeOfDay = timeOfDay
        self.mood = mood
        self.characters = characters
        self.moral = moral
        self.durationMinutes = durationMinutes
        self.isLibraryStory = isLibraryStory
        self.isFavorite = isFavorite
        self.createdAt = createdAt
        self.lastPlayedAt = lastPlayedAt
        self.playCount = playCount
        self.coverURL = coverURL
    }

    var orderedParagraphs: [StoryParagraph] { paragraphs.sorted { $0.index < $1.index } }
}

@Model
final class StoryParagraph {
    var index: Int
    var text: String
    var sceneHint: String
    var emotion: ParagraphEmotion
    /// Uzak ses dosyası (CDN).
    var audioURL: URL?
    /// Çevrimdışı dinleme için indirilmiş yerel dosya adı (Application Support/Audio altında).
    var localAudioFileName: String?

    var story: Story?

    init(index: Int, text: String, sceneHint: String, emotion: ParagraphEmotion,
         audioURL: URL? = nil, localAudioFileName: String? = nil) {
        self.index = index
        self.text = text
        self.sceneHint = sceneHint
        self.emotion = emotion
        self.audioURL = audioURL
        self.localAudioFileName = localAudioFileName
    }
}

/// Çocuğun masallarında doğan ve geri dönebilen karakterler ("çocuğun hafızası").
@Model
final class RecurringCharacter {
    @Attribute(.unique) var id: UUID
    var name: String
    /// Kısa karakter kartı: görünüş + kişilik (LLM'e bağlam olarak gider).
    var card: String
    var firstStoryID: String?
    var appearances: Int
    var child: ChildProfile?

    init(id: UUID = UUID(), name: String, card: String, firstStoryID: String? = nil, appearances: Int = 1) {
        self.id = id
        self.name = name
        self.card = card
        self.firstStoryID = firstStoryID
        self.appearances = appearances
    }
}

/// Hazine Sandığı ödülleri (§3.6).
@Model
final class Sticker {
    @Attribute(.unique) var id: UUID
    enum Kind: String, Codable, Sendable { case sticker, outfit }
    var kind: Kind
    /// Görsel anahtarı, ör. "sticker_moon", "outfit_pamuk_nightcap".
    var assetKey: String
    var earnedAt: Date
    var storyID: String?
    /// Hazine Sandığı'nda henüz görülmedi: haritadaki sandık düğmesinde küçük bir parıltı (gece kutlama yok).
    var isNew: Bool = true
    var child: ChildProfile?

    init(id: UUID = UUID(), kind: Kind, assetKey: String, earnedAt: Date = .now, storyID: String? = nil) {
        self.id = id
        self.kind = kind
        self.assetKey = assetKey
        self.earnedAt = earnedAt
        self.storyID = storyID
    }
}

/// Ebeveyn ayarları.
/// VARSAYIM: şartnamedeki `Settings` adı SwiftUI'nin `Settings` sahne tipiyle çakıştığı için `AppSettings` dedik.
@Model
final class AppSettings {
    var voice: VoiceTone
    var subtitlesEnabled: Bool
    var ambientSoundEnabled: Bool
    var hapticsEnabled: Bool
    var contentFilters: ContentFilters
    var defaultDuration: StoryDuration
    var lullabyMinutesAfterStory: Int   // 0 = kapalı, 10…30
    /// Masal bittikten sonra çalan sakin ses: ninni ya da beyaz gürültü (§3.4).
    var afterStorySound: AfterStorySound = AfterStorySound.lullaby
    /// Masal sırasında alçak sesle ninni fonu.
    var backgroundLullabyEnabled: Bool = false
    var voiceCloneConsentAt: Date?
    var hasVoiceClone: Bool

    init(voice: VoiceTone = .mother, subtitlesEnabled: Bool = false, ambientSoundEnabled: Bool = true,
         hapticsEnabled: Bool = true, contentFilters: ContentFilters = .default,
         defaultDuration: StoryDuration = .ten, lullabyMinutesAfterStory: Int = 15,
         voiceCloneConsentAt: Date? = nil, hasVoiceClone: Bool = false) {
        self.voice = voice
        self.subtitlesEnabled = subtitlesEnabled
        self.ambientSoundEnabled = ambientSoundEnabled
        self.hapticsEnabled = hapticsEnabled
        self.contentFilters = contentFilters
        self.defaultDuration = defaultDuration
        self.lullabyMinutesAfterStory = lullabyMinutesAfterStory
        self.voiceCloneConsentAt = voiceCloneConsentAt
        self.hasVoiceClone = hasVoiceClone
    }
}

/// Abonelik durumunun yerel önbelleği. Doğruluk kaynağı backend'dir (§5.1, §4.6).
@Model
final class Entitlement {
    enum Tier: String, Codable, Sendable { case free, premium }
    var tier: Tier
    var productID: String?
    var expiresAt: Date?
    var isInTrial: Bool
    var lastVerifiedAt: Date?
    /// Masal Dükkanı'ndan alınmış tek seferlik paketler (sunucu doğrulamasından sonra).
    var ownedProductIDs: [String] = []

    init(tier: Tier = .free, productID: String? = nil, expiresAt: Date? = nil,
         isInTrial: Bool = false, lastVerifiedAt: Date? = nil) {
        self.tier = tier
        self.productID = productID
        self.expiresAt = expiresAt
        self.isInTrial = isInTrial
        self.lastVerifiedAt = lastVerifiedAt
    }

    /// Davet ödülüyle gelen Premium (App Store aboneliği değil). Sunucudaki REFERRAL_PRODUCT_ID ile aynı.
    static let referralProductID = "masalcik.referral.week"

    var isPremium: Bool {
        guard tier == .premium else { return false }
        guard let expiresAt else { return true }
        return expiresAt > .now
    }
}
