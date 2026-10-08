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

    var title: String {
        switch self {
        case .sleepHouse: String(localized: "Uyku Evi")
        case .whisperForest: String(localized: "Fısıltı Ormanı")
        case .starHill: String(localized: "Yıldız Tepesi")
        case .lighthouseCove: String(localized: "Deniz Feneri Koyu")
        case .storytellerPlane: String(localized: "Masalcı Çınarı")
        case .feelingsGarden: String(localized: "Duygu Bahçesi")
        case .treasureChest: String(localized: "Hazine Sandığı")
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

    var displayName: String {
        switch self {
        case .pamuk: String(localized: "Pamuk")
        case .findik: String(localized: "Fındık")
        case .lodos: String(localized: "Lodos")
        case .nur: String(localized: "Bilge Baykuş Nur")
        case .yildiz: String(localized: "Yıldız")
        case .kaptanMidye: String(localized: "Kaptan Midye")
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
    var title: String {
        switch self {
        case .adventure: String(localized: "Macera")
        case .funny: String(localized: "Komik")
        case .calm: String(localized: "Sakin")
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
    var title: String {
        switch self {
        case .animals: String(localized: "Hayvanlar")
        case .space: String(localized: "Uzay")
        case .sea: String(localized: "Deniz")
        case .princesses: String(localized: "Prensesler")
        case .superheroes: String(localized: "Süper kahramanlar")
        case .dinosaurs: String(localized: "Dinozorlar")
        case .football: String(localized: "Futbol")
        case .vehicles: String(localized: "Araçlar")
        case .music: String(localized: "Müzik")
        case .nature: String(localized: "Doğa")
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
    var title: String {
        switch self {
        case .newSibling: String(localized: "Yeni kardeş")
        case .startingSchool: String(localized: "Kreşe / okula başlamak")
        case .fearOfDark: String(localized: "Karanlıktan korkmak")
        case .sharing: String(localized: "Paylaşmak")
        case .brushingTeeth: String(localized: "Diş fırçalamak")
        case .courage: String(localized: "Cesaret")
        }
    }
}

/// Seslendirme tonu (§4.5).
enum VoiceTone: String, Codable, CaseIterable, Identifiable, Sendable {
    case mother, father, grandmother, grandfather, parentClone = "parent_clone"
    var id: String { rawValue }
    var title: String {
        switch self {
        case .mother: String(localized: "Anne")
        case .father: String(localized: "Baba")
        case .grandmother: String(localized: "Nine")
        case .grandfather: String(localized: "Dede")
        case .parentClone: String(localized: "Kendi sesim")
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
