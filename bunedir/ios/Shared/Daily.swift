import Foundation

/// "Günün kelimesi" kuralı. Referansı: scripts/lib/daily.mjs; ortak vektörler: content/test-vectors.json.
enum Daily {
    static let slotHours = 3
    static let slotsPerDay = 24 / slotHours
    /// dilim → kaç gün önceki kelime tekrar edilir (aralıklı tekrar)
    static let reviewSlots: [Int: Int] = [4: 1, 6: 3, 7: 7]
    /// 15:00 dilimi: 1000 kelimelik sözlükten günün kelimesi.
    static let dictionarySlot = 5

    enum Kind: String, Sendable { case today, review, dictionary }

    struct Entry: Equatable, Sendable {
        let kind: Kind
        /// Bölüm kelimesi (arka plan sahnesi bundan gelir).
        let word: Word
        let daysAgo: Int
        let image: String
        /// Yalnızca .dictionary için: sözlükten gösterilecek kelime.
        var dict: DictEntry? = nil
    }

    private static func mod(_ a: Int, _ n: Int) -> Int { ((a % n) + n) % n }

    /// Yerel takvim tarihinden epoch'a gün farkı (saat diliminden ve yaz saatinden bağımsız).
    static func dayIndex(year: Int, month: Int, day: Int, epoch: String) -> Int {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let e = epoch.split(separator: "-").compactMap { Int($0) }
        let from = utc.date(from: DateComponents(year: e[0], month: e[1], day: e[2]))!
        let to = utc.date(from: DateComponents(year: year, month: month, day: day))!
        return utc.dateComponents([.day], from: from, to: to).day!
    }

    static func dayIndex(for date: Date, calendar: Calendar = .current, epoch: String = Content.shared.epoch) -> Int {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return dayIndex(year: c.year!, month: c.month!, day: c.day!, epoch: epoch)
    }

    static func slot(for date: Date, calendar: Calendar = .current) -> Int {
        calendar.component(.hour, from: date) / slotHours
    }

    static func word(forDay day: Int, words: [Word] = Content.words) -> Word {
        words[mod(day, words.count)]
    }

    static func dictionary(forDay day: Int, pool: [DictEntry] = Lexicon.dailyPool) -> DictEntry {
        pool[mod(day, pool.count)]
    }

    static func entry(day: Int, slot: Int, words: [Word] = Content.words, pool: [DictEntry] = Lexicon.dailyPool) -> Entry {
        let ago = reviewSlots[slot] ?? 0
        let w = word(forDay: day - ago, words: words)
        let imgs = w.images
        let image = imgs[mod(day * slotsPerDay + slot, imgs.count)]
        if slot == dictionarySlot {
            return Entry(kind: .dictionary, word: w, daysAgo: 0, image: image, dict: dictionary(forDay: day, pool: pool))
        }
        return Entry(kind: ago > 0 ? .review : .today, word: w, daysAgo: ago, image: image)
    }

    static func entry(at date: Date, calendar: Calendar = .current) -> Entry {
        entry(day: dayIndex(for: date, calendar: calendar), slot: slot(for: date, calendar: calendar))
    }

    static func today(_ date: Date = .now) -> Word { word(forDay: dayIndex(for: date)) }

    /// `date`'ten başlayarak sonraki dilim başlangıçları (widget zaman çizelgesi için).
    static func slotStarts(from date: Date, count: Int, calendar: Calendar = .current) -> [Date] {
        let startOfDay = calendar.startOfDay(for: date)
        let current = calendar.date(byAdding: .hour, value: slot(for: date, calendar: calendar) * slotHours, to: startOfDay)!
        return (0..<count).compactMap { calendar.date(byAdding: .hour, value: $0 * slotHours, to: current) }
    }

    /// Son `days` günün kelimeleri (bugün dahil, tekrarsız) — "Hatırla" testi bunlardan sorar.
    static func recentWords(days: Int, from date: Date = .now) -> [Word] {
        let today = dayIndex(for: date)
        var seen = Set<Int>()
        return (0..<days).map { word(forDay: today - $0) }.filter { seen.insert($0.no).inserted }
    }
}
