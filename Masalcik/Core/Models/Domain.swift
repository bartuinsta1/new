import Foundation

// MARK: - Ortak alan tipleri
// Bu tipler hem SwiftData modellerinde hem de backend DTO'larında kullanılır.
// Ham değerler (rawValue) backend sözleşmesinin parçasıdır; değiştirmeyin.

/// Masal Adası bölgeleri (şartname §2.3).
enum Region: String, Codable, CaseIterable, Identifiable, Sendable {
    case sleepHouse = "sleep_house"         // Uyku Evi
    case whisperForest = "whisper_forest"   // Fısıltı Ormanı
    case starHill = "star_hill"             // Yıldız Tepesi
    case lighthouseCove = "lighthouse_cove" // Deniz Feneri Koyu
    case storytellerPlane = "storyteller_plane" // Masalcı Çınarı
    case feelingsGarden = "feelings_garden" // Duygu Bahçesi
    case treasureChest = "treasure_chest"   // Hazine Sandığı

    var id: String { rawValue }

    var title: String { title(in: .current) }

    func title(in lang: AppLanguage) -> String {
        switch self {
        case .sleepHouse: String(localized: "Uyku Evi", bundle: lang.bundle)
        case .whisperForest: String(localized: "Fısıltı Ormanı", bundle: lang.bundle)
        case .starHill: String(localized: "Yıldız Tepesi", bundle: lang.bundle)
        case .lighthouseCove: String(localized: "Deniz Feneri Koyu", bundle: lang.bundle)
        case .storytellerPlane: String(localized: "Masalcı Çınarı", bundle: lang.bundle)
        case .feelingsGarden: String(localized: "Duygu Bahçesi", bundle: lang.bundle)
        case .treasureChest: String(localized: "Hazine Sandığı", bundle: lang.bundle)
        }
    }

    /// Bölgenin rehber karakteri.
    var guide: CharacterID {
        switch self {
        case .sleepHouse, .treasureChest: .pamuk
        case .whisperForest: .findik
        case .starHill: .yildiz
        case .lighthouseCove: .kaptanMidye
        case .storytellerPlane: .nur
        case .feelingsGarden: .lodos
        }
    }

    /// Masal geçebilecek bölgeler (Hazine Sandığı bir masal mekânı değildir).
    static var storyRegions: [Region] { allCases.filter { $0 != .treasureChest } }
}

/// Kalıcı karakter kadrosu (şartname §2.4).
enum CharacterID: String, Codable, CaseIterable, Identifiable, Sendable {
    case pamuk, findik, lodos, nur, yildiz
    case kaptanMidye = "kaptan_midye"

    var id: String { rawValue }

    var displayName: String { displayName(in: .current) }

    func displayName(in lang: AppLanguage) -> String {
        switch self {
        case .pamuk: String(localized: "Pamuk", bundle: lang.bundle)
        case .findik: String(localized: "Fındık", bundle: lang.bundle)
        case .lodos: String(localized: "Lodos", bundle: lang.bundle)
        case .nur: String(localized: "Bilge Baykuş Nur", bundle: lang.bundle)
        case .yildiz: String(localized: "Yıldız", bundle: lang.bundle)
        case .kaptanMidye: String(localized: "Kaptan Midye", bundle: lang.bundle)
        }
    }

    /// Asset adı öneki: `char_pamuk_happy` gibi.
    var assetPrefix: String { "char_\(rawValue)" }
}

/// Karakter duygu durumu.
enum CharacterMood: String, Codable, CaseIterable, Sendable {
    case happy, surprised, sleepy
}

/// Masal havası (şartname §4.1).
enum StoryMood: String, Codable, CaseIterable, Identifiable, Sendable {
    case adventure, funny, calm
    var id: String { rawValue }
    var title: String { title(in: .current) }

    func title(in lang: AppLanguage) -> String {
        switch self {
        case .adventure: String(localized: "Macera", bundle: lang.bundle)
        case .funny: String(localized: "Komik", bundle: lang.bundle)
        case .calm: String(localized: "Sakin", bundle: lang.bundle)
        }
    }
}

/// Paragraf duygusu: TTS tonunu hafifçe değiştirir (§4.5).
enum ParagraphEmotion: String, Codable, CaseIterable, Sendable {
    case neutral, surprised, whisper, smiling, sleepy
}

/// İlgi alanları (onboarding §3.1 adım 4).
enum Interest: String, Codable, CaseIterable, Identifiable, Sendable {
    case animals, space, sea, princesses, superheroes, dinosaurs, football, vehicles, music, nature
    var id: String { rawValue }
    var title: String { title(in: .current) }

    func title(in lang: AppLanguage) -> String {
        switch self {
        case .animals: String(localized: "Hayvanlar", bundle: lang.bundle)
        case .space: String(localized: "Uzay", bundle: lang.bundle)
        case .sea: String(localized: "Deniz", bundle: lang.bundle)
        case .princesses: String(localized: "Prensesler", bundle: lang.bundle)
        case .superheroes: String(localized: "Süper kahramanlar", bundle: lang.bundle)
        case .dinosaurs: String(localized: "Dinozorlar", bundle: lang.bundle)
        case .football: String(localized: "Futbol", bundle: lang.bundle)
        case .vehicles: String(localized: "Araçlar", bundle: lang.bundle)
        case .music: String(localized: "Müzik", bundle: lang.bundle)
        case .nature: String(localized: "Doğa", bundle: lang.bundle)
        }
    }
    var emoji: String {
        switch self {
        case .animals: "🐻"; case .space: "🚀"; case .sea: "🐠"; case .princesses: "👑"
        case .superheroes: "🦸"; case .dinosaurs: "🦕"; case .football: "⚽️"; case .vehicles: "🚒"
        case .music: "🎵"; case .nature: "🌳"
        }
    }
}

/// Değerler ve gündem konuları (§3.1 adım 5).
enum ValueTopic: String, Codable, CaseIterable, Identifiable, Sendable {
    case newSibling = "new_sibling"
    case startingSchool = "starting_school"
    case fearOfDark = "fear_of_dark"
    case sharing
    case brushingTeeth = "brushing_teeth"
    case courage
    var id: String { rawValue }
    var title: String { title(in: .current) }

    func title(in lang: AppLanguage) -> String {
        switch self {
        case .newSibling: String(localized: "Yeni kardeş", bundle: lang.bundle)
        case .startingSchool: String(localized: "Kreşe / okula başlamak", bundle: lang.bundle)
        case .fearOfDark: String(localized: "Karanlıktan korkmak", bundle: lang.bundle)
        case .sharing: String(localized: "Paylaşmak", bundle: lang.bundle)
        case .brushingTeeth: String(localized: "Diş fırçalamak", bundle: lang.bundle)
        case .courage: String(localized: "Cesaret", bundle: lang.bundle)
        }
    }

    var emoji: String {
        switch self {
        case .newSibling: "👶"; case .startingSchool: "🎒"; case .fearOfDark: "🌙"
        case .sharing: "🤝"; case .brushingTeeth: "🪥"; case .courage: "🦁"
        }
    }
}

/// Seslendirme tonu (§4.5).
enum VoiceTone: String, Codable, CaseIterable, Identifiable, Sendable {
    case mother, father, grandmother, grandfather, parentClone = "parent_clone"
    var id: String { rawValue }
    var title: String { title(in: .current) }

    func title(in lang: AppLanguage) -> String {
        switch self {
        case .mother: String(localized: "Anne", bundle: lang.bundle)
        case .father: String(localized: "Baba", bundle: lang.bundle)
        case .grandmother: String(localized: "Nine", bundle: lang.bundle)
        case .grandfather: String(localized: "Dede", bundle: lang.bundle)
        case .parentClone: String(localized: "Kendi sesim", bundle: lang.bundle)
        }
    }
}

/// Ebeveynin açıp kapatabildiği hassas temalar. Varsayılan: hepsi kapalı (§3.7).
struct ContentFilters: Codable, Hashable, Sendable {
    var allowMildScary = false
    var allowConflict = false
    var allowLossAndSeparation = false

    static let `default` = ContentFilters()
}

/// Masal süresi seçenekleri.
enum StoryDuration: Int, Codable, CaseIterable, Sendable {
    case five = 5, ten = 10, fifteen = 15
}

/// Uyku saati (saat:dakika). Gece modu buna göre açılır.
struct Bedtime: Codable, Hashable, Sendable {
    var hour: Int
    var minute: Int
    /// VARSAYIM: varsayılan uyku saati 20:00; gece modu uyku saatinden 60 dk önce (19:00) başlar.
    static let `default` = Bedtime(hour: 20, minute: 0)
}

/// Çocuğun avatarı (§2.5).
struct AvatarConfig: Codable, Hashable, Sendable {
    var faceTemplate: Int      // 0...5
    var skinTone: Int          // 0...5, DesignSystem.AvatarPalette.skin
    var hairStyle: Int         // 0...5
    var hairColor: Int         // 0...5, DesignSystem.AvatarPalette.hair
    var pajamaColor: Int       // 0...5, DesignSystem.AvatarPalette.pajama

    static let `default` = AvatarConfig(faceTemplate: 0, skinTone: 2, hairStyle: 0, hairColor: 1, pajamaColor: 0)
}

/// Masal sonrası sakin ses.
enum AfterStorySound: String, Codable, CaseIterable, Sendable {
    case lullaby, whiteNoise = "white_noise"
    /// Paketteki ses dosyası adı (`Resources/Sounds/<ad>.m4a`). Dosya yoksa sessizce atlanır.
    var resourceName: String { self == .lullaby ? "lullaby" : "white_noise" }
}
