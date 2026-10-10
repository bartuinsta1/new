import Foundation

// MARK: - Oynatıcının saf mantığı (UI ve AVFoundation'dan bağımsız; birim testli)

/// Çalınacak tek parça. Masal paragraf paragraf akar; her paragraf bir segmenttir.
enum AudioSegment: Equatable, Sendable {
    /// İndirilmiş ses (çevrimdışı dinleme).
    case file(URL, text: String)
    /// Sunucudaki ses (CDN).
    case remote(URL, text: String)
    /// Ses yoksa (TTS hatası, sahte backend): cihaz içi konuşma sentezi. Çocuk hata görmez.
    case speech(text: String, emotion: ParagraphEmotion)

    var text: String {
        switch self {
        case .file(_, let t), .remote(_, let t): t
        case .speech(let t, _): t
        }
    }
}

enum SegmentPlanner {
    /// Önce yerel dosya, sonra uzak URL, ikisi de yoksa konuşma sentezi.
    static func segment(text: String, emotion: ParagraphEmotion, audioURL: URL?, localFile: URL?,
                        fileExists: (URL) -> Bool = { FileManager.default.fileExists(atPath: $0.path) }) -> AudioSegment {
        if let localFile, fileExists(localFile) { return .file(localFile, text: text) }
        if let audioURL { return .remote(audioURL, text: text) }
        return .speech(text: text, emotion: emotion)
    }
}

/// Uyku zamanlayıcı (§3.4): masal bitince / 15 / 30 / 45 dk.
enum SleepTimerOption: Int, CaseIterable, Sendable {
    case endOfStory = 0, fifteen = 15, thirty = 30, fortyFive = 45

    /// Sabit süreli seçenekte tüm sesin (masal + ninni) duracağı an.
    func deadline(from start: Date) -> Date? {
        self == .endOfStory ? nil : start.addingTimeInterval(TimeInterval(rawValue * 60))
    }

    /// Düğmeye her dokunuşta sıradaki seçenek (tek büyük düğme; çocuk için menü yok).
    var next: SleepTimerOption {
        let all = Self.allCases
        return all[(all.firstIndex(of: self)! + 1) % all.count]
    }

    var label: String {
        switch self {
        case .endOfStory: String(localized: "Masal bitince")
        case .fifteen: String(localized: "15 dk")
        case .thirty: String(localized: "30 dk")
        case .fortyFive: String(localized: "45 dk")
        }
    }
}

/// Masal ilerlemesi: paragraflar metin uzunluğuyla ağırlıklandırılır (uzun paragraf daha uzun sürer).
struct PlaybackProgress: Equatable, Sendable {
    let weights: [Double]

    init(texts: [String]) {
        let lengths = texts.map { Double(max($0.count, 1)) }
        let total = lengths.reduce(0, +)
        weights = total > 0 ? lengths.map { $0 / total } : []
    }

    /// 0…1. `segmentFraction`: o anki paragrafın çalınan oranı.
    func fraction(segmentIndex: Int, segmentFraction: Double) -> Double {
        guard !weights.isEmpty else { return 0 }
        let i = min(max(segmentIndex, 0), weights.count)
        let done = weights.prefix(i).reduce(0, +)
        let current = i < weights.count ? weights[i] * min(max(segmentFraction, 0), 1) : 0
        return min(done + current, 1)
    }
}

/// Karaoke altyazı: o an okunan kelime. Sunucu kelime zamanlaması vermediği için
/// kelimeler harf sayısıyla orantılı varsayılır (cihaz sentezinde gerçek aralık kullanılır).
enum KaraokeTiming {
    /// Metindeki kelimelerin aralıkları.
    static func wordRanges(in text: String) -> [Range<String.Index>] {
        var ranges: [Range<String.Index>] = []
        text.enumerateSubstrings(in: text.startIndex..., options: .byWords) { _, range, _, _ in ranges.append(range) }
        return ranges
    }

    /// `fraction` (0…1) anında okunan kelimenin sırası; metin boşsa nil.
    static func wordIndex(in text: String, fraction: Double) -> Int? {
        let ranges = wordRanges(in: text)
        guard !ranges.isEmpty else { return nil }
        let target = Double(text.count) * min(max(fraction, 0), 1)
        for (i, r) in ranges.enumerated() where Double(text.distance(from: text.startIndex, to: r.upperBound)) >= target {
            return i
        }
        return ranges.count - 1
    }

    /// Cihaz sentezinin bildirdiği karakter konumundan kelime sırası.
    static func wordIndex(in text: String, utf16Location: Int) -> Int? {
        let ranges = wordRanges(in: text)
        guard !ranges.isEmpty else { return nil }
        let loc = String.Index(utf16Offset: min(utf16Location, text.utf16.count), in: text)
        return ranges.lastIndex { $0.lowerBound <= loc } ?? 0
    }
}

/// Sesin yavaşça kısılması (zamanlayıcı ve ninni sonu): yumuşak eğri, ani kesilme yok.
enum VolumeFade {
    static let duration: TimeInterval = 30

    /// `elapsed` saniye sonra ses seviyesi (başlangıç `from`).
    static func volume(from: Float, elapsed: TimeInterval, duration: TimeInterval = duration) -> Float {
        guard duration > 0 else { return 0 }
        let t = min(max(elapsed / duration, 0), 1)
        // easeInOut: önce fark edilmeden, sonda yumuşakça.
        let eased = t * t * (3 - 2 * t)
        return from * Float(1 - eased)
    }
}

/// Oynatıcının yaşam döngüsü.
enum PlaybackPhase: Equatable, Sendable {
    case waitingForAudio    // akış sürüyor, ilk paragraf henüz gelmedi
    case playing
    case paused
    case goodnight          // "İyi geceler, Ayşe"
    case afterStorySound(endsAt: Date)
    case finished           // sessizce durdu; sıradaki masal OTOMATİK BAŞLAMAZ
}
