import Foundation

/// content/dictionary.json'daki bir kelime (1000+ kelimelik sözlük; 50 bölüm de içinde).
struct DictEntry: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let word: String
    let origin: String
    let meaning: String
    let triggers: [String]
    /// Bölüm kelimesiyse bölüm numarası (hikâyesi, sahneleri var).
    let episode: Int?
    /// Gündelik kelime: sözlükte durur ama klavye bunun için konuşmaz, widget'ta çıkmaz.
    let common: Bool?

    var isCommon: Bool { common ?? false }
    var episodeWord: Word? { episode.flatMap(Content.word(no:)) }
}

private struct DictionaryFile: Codable { let count: Int; let entries: [DictEntry] }

enum Lexicon {
    static let entries: [DictEntry] = load(from: Bundle.main)

    static func load(from bundle: Bundle) -> [DictEntry] {
        guard let url = bundle.url(forResource: "dictionary", withExtension: "json", subdirectory: "content"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(DictionaryFile.self, from: data) else {
            fatalError("content/dictionary.json pakette yok ya da bozuk")
        }
        return file.entries
    }

    static func entry(id: String) -> DictEntry? { byID[id] }
    private static let byID: [String: DictEntry] = Dictionary(uniqueKeysWithValues: entries.map { ($0.id, $0) })

    /// Widget'ın "sözlükten" kartında dönen kelimeler: bölüm ve gündelik olmayanlar, dosyadaki sırayla.
    static let dailyPool: [DictEntry] = entries.filter { !$0.isCommon && $0.episode == nil }

    /// Sözlük ekranındaki dil süzgeci.
    enum Family: String, CaseIterable, Identifiable {
        case all = "Hepsi", japanese = "Japonca", arabic = "Arapça", persian = "Farsça", turkish = "Türkçe", world = "Dünya"
        var id: String { rawValue }
        func contains(_ e: DictEntry) -> Bool {
            switch self {
            case .all: true
            case .japanese: e.origin.hasPrefix("Japonca")
            case .arabic: e.origin.hasPrefix("Arapça")
            case .persian: e.origin.hasPrefix("Farsça")
            case .turkish: e.origin.hasPrefix("Türkçe")
            case .world: !["Japonca", "Arapça", "Farsça", "Türkçe"].contains { e.origin.hasPrefix($0) }
            }
        }
    }

    static func search(_ query: String, family: Family = .all) -> [DictEntry] {
        let q = Muse.fold(query.trimmingCharacters(in: .whitespaces))
        let list = entries.filter(family.contains)
        guard !q.isEmpty else { return list.sorted { Muse.fold($0.word) < Muse.fold($1.word) } }
        let hits = list.filter { Muse.fold($0.word).contains(q) || Muse.fold($0.meaning).contains(q) }
        // Önce kelimenin kendisi q ile başlayanlar, sonra anlamında geçenler.
        return hits.sorted { a, b in
            let pa = Muse.fold(a.word).hasPrefix(q), pb = Muse.fold(b.word).hasPrefix(q)
            return pa != pb ? pa : Muse.fold(a.word) < Muse.fold(b.word)
        }
    }
}

/// Klavyenin "ilham" motoru. Referans: scripts/lib/muse.mjs; vektörler: content/muse-vectors.json.
/// Tamamen cihazda çalışır; hiçbir metin dışarı gönderilmez.
enum Muse {
    static let windowTokens = 12

    enum Kind: String, Sendable { case word, feeling }

    struct Suggestion: Equatable, Sendable {
        let kind: Kind
        let entry: DictEntry
        let token: String
    }

    struct Prepared: Sendable {
        let entry: DictEntry
        let keys: [[String]]
        let triggers: [[String]]
    }

    private static let foldMap: [Character: String] = [
        "İ": "i", "I": "i", "ı": "i", "â": "a", "î": "i", "û": "u", "ā": "a", "ē": "e", "ī": "i", "ō": "o", "ū": "u",
        "é": "e", "è": "e", "ê": "e", "à": "a", "á": "a", "ó": "o", "ú": "u", "í": "i", "ñ": "n", "ã": "a", "õ": "o",
    ]

    /// Küçük harf + şapka/uzatma işaretlerini kaldır; ı → i. ç ğ ö ş ü korunur.
    static func fold(_ s: String) -> String {
        var out = ""
        for ch in s {
            if let m = foldMap[ch] { out += m; continue }
            let lower = String(ch).lowercased()
            if lower.count == 1, let m = foldMap[Character(lower)] { out += m } else { out += lower }
        }
        return out
    }

    static func isLetter(_ ch: Character) -> Bool { ch.isLetter || ch.isNumber }

    static func tokens(_ s: String) -> [String] {
        var out: [String] = []
        var cur = ""
        for ch in fold(s) {
            if isLetter(ch) { cur.append(ch) } else if !cur.isEmpty { out.append(cur); cur = "" }
        }
        if !cur.isEmpty { out.append(cur) }
        return out
    }

    static func prepare(_ entries: [DictEntry]) -> [Prepared] {
        entries.filter { !$0.isCommon }.map { e in
            let key = tokens(e.word)
            let keys = (key.count > 1 || (key.count == 1 && key[0].count >= 4)) ? [key] : []
            let triggers = e.triggers.map(tokens).filter { !$0.isEmpty && $0.joined().count >= 3 }
            return Prepared(entry: e, keys: keys, triggers: triggers)
        }
    }

    static let shared: [Prepared] = prepare(Lexicon.entries)

    static func suggest(_ text: String, in prepared: [Prepared] = shared) -> Suggestion? {
        guard let last = text.last, !isLetter(last) else { return nil }
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let parts = text.split(omittingEmptySubsequences: false, whereSeparator: { ".!?\n\r\n".contains($0) })
            .filter { $0.contains(where: \.isLetter) }
        let toks = Array(tokens(String(parts.last ?? "")).suffix(windowTokens))
        guard !toks.isEmpty else { return nil }

        // 1) Kelimenin kendisi yazıldı mı?
        var best: (end: Int, len: Int, entry: DictEntry)?
        for p in prepared {
            for key in p.keys where key.count <= toks.count {
                for end in stride(from: toks.count, through: key.count, by: -1) {
                    let start = end - key.count
                    if Array(toks[start..<end]) == key {
                        if best == nil || end > best!.end || (end == best!.end && key.count > best!.len) {
                            best = (end, key.count, p.entry)
                        }
                        break
                    }
                }
            }
        }
        if let best {
            return Suggestion(kind: .word, entry: best.entry, token: toks[(best.end - best.len)..<best.end].joined(separator: " "))
        }

        // 2) Tetikleyici: en sondaki kelimeden geriye
        for end in stride(from: toks.count, through: 1, by: -1) {
            let cands = prepared.filter { p in p.triggers.contains { matches(toks, end: end, $0) } }
            if !cands.isEmpty {
                let token = toks[end - 1]
                let sum = token.unicodeScalars.reduce(0) { $0 + Int($1.value) }
                return Suggestion(kind: .feeling, entry: cands[sum % cands.count].entry, token: token)
            }
        }
        return nil
    }

    private static func matches(_ toks: [String], end: Int, _ t: [String]) -> Bool {
        let start = end - t.count
        guard start >= 0 else { return false }
        for i in 0..<(t.count - 1) where toks[start + i] != t[i] { return false }
        return toks[end - 1].hasPrefix(t[t.count - 1])
    }

    /// Klavye boştayken söylenecek "edebi" söz: bölümlerin tek sözleri ve günün kelimesi, dakikaya göre döner.
    static func idleLine(at date: Date = .now) -> String {
        let words = Content.words
        let minute = Int(date.timeIntervalSince1970 / 60)
        if minute % 4 == 0 {
            let w = Daily.today(date)
            return "Bugünün kelimesi: \(w.word) — \(w.meaning)"
        }
        return "“\(words[minute % words.count].oneLiner)”"
    }
}
