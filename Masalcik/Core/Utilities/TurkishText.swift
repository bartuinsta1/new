import Foundation

/// Türkçe metin yardımcıları: ünlü uyumuna göre ek, yerel ayara duyarlı büyük/küçük harf, sayıların yazıyla okunuşu.
/// Kişisel adlar masallarda sürekli eklerle geçtiği için ("Ayşe'ye", "Mert'e") bu kurallar kritik.
enum TurkishText {
    static let locale = Locale(identifier: "tr_TR")

    private static let backVowels: Set<Character> = ["a", "ı", "o", "u"]
    private static let roundedVowels: Set<Character> = ["o", "ö", "u", "ü"]
    private static let vowels: Set<Character> = ["a", "e", "ı", "i", "o", "ö", "u", "ü"]
    /// "Fıstıkçı Şahap" sert ünsüzleri.
    private static let hardConsonants: Set<Character> = ["f", "s", "t", "k", "ç", "ş", "h", "p"]

    // MARK: Büyük/küçük harf

    /// "istanbul" → "İSTANBUL", "ılık" → "ILIK".
    static func uppercased(_ s: String) -> String { s.uppercased(with: locale) }
    /// "İSTANBUL" → "istanbul", "IŞIK" → "ışık".
    static func lowercased(_ s: String) -> String { s.lowercased(with: locale) }

    // MARK: Ünlü uyumu

    private static func normalizedLastWord(_ word: String) -> String {
        let last = word.split(separator: " ").last.map(String.init) ?? word
        return lowercased(last)
    }

    static func lastVowel(of word: String) -> Character? {
        normalizedLastWord(word).last(where: { vowels.contains($0) })
    }

    static func endsWithVowel(_ word: String) -> Bool {
        guard let c = normalizedLastWord(word).last else { return false }
        return vowels.contains(c)
    }

    static func endsWithHardConsonant(_ word: String) -> Bool {
        guard let c = normalizedLastWord(word).last else { return false }
        return hardConsonants.contains(c)
    }

    /// İki yönlü uyum: a/e
    private static func twoWay(_ word: String) -> Character {
        guard let v = lastVowel(of: word) else { return "e" }
        return backVowels.contains(v) ? "a" : "e"
    }

    /// Dört yönlü uyum: ı/i/u/ü
    private static func fourWay(_ word: String) -> Character {
        guard let v = lastVowel(of: word) else { return "i" }
        switch (backVowels.contains(v), roundedVowels.contains(v)) {
        case (true, false): return "ı"
        case (false, false): return "i"
        case (true, true): return "u"
        case (false, true): return "ü"
        }
    }

    // MARK: Hal ekleri (özel adlar kesme işaretiyle)

    /// Yönelme: Ayşe'ye, Mert'e, Fındık'a, Kaptan Midye'ye.
    static func dative(_ name: String) -> String {
        let a = twoWay(name)
        return endsWithVowel(name) ? "\(name)'y\(a)" : "\(name)'\(a)"
    }

    /// Bulunma: Ayşe'de, Mert'te, Ali'de. `afterPossessive` → "Fısıltı Ormanı'nda", "Yıldız Tepesi'nde".
    static func locative(_ name: String, afterPossessive: Bool = false) -> String {
        let a = twoWay(name)
        if afterPossessive && endsWithVowel(name) { return "\(name)'nd\(a)" }
        let d: Character = endsWithHardConsonant(name) ? "t" : "d"
        return "\(name)'\(d)\(a)"
    }

    /// Ayrılma: Ayşe'den, Mert'ten.
    static func ablative(_ name: String, afterPossessive: Bool = false) -> String {
        let a = twoWay(name)
        let e: Character = a == "a" ? "a" : "e"
        if afterPossessive && endsWithVowel(name) { return "\(name)'nd\(e)n" }
        let d: Character = endsWithHardConsonant(name) ? "t" : "d"
        return "\(name)'\(d)\(e)n"
    }

    /// İlgi: Ayşe'nin, Mert'in, Pamuk'un, Ömür'ün.
    static func genitive(_ name: String) -> String {
        let i = fourWay(name)
        return endsWithVowel(name) ? "\(name)'n\(i)n" : "\(name)'\(i)n"
    }

    // MARK: Sayıların okunuşu (ebeveyn kapısı için)

    private static let ones = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
    private static let tens = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]

    /// 0…999 arası sayıyı yazıyla döndürür: 63 → "altmış üç", 100 → "yüz", 205 → "iki yüz beş".
    static func numberWords(_ n: Int) -> String {
        precondition((0...999).contains(n), "Yalnızca 0…999 desteklenir")
        if n == 0 { return "sıfır" }
        var parts: [String] = []
        let h = n / 100, t = (n / 10) % 10, o = n % 10
        if h > 0 { parts.append(h == 1 ? "yüz" : "\(ones[h]) yüz") }
        if t > 0 { parts.append(tens[t]) }
        if o > 0 { parts.append(ones[o]) }
        return parts.joined(separator: " ")
    }
}

extension Region {
    /// "Fısıltı Ormanı'nda" — bölge adları birer tamlama olduğu için kaynaştırma "n" alır.
    var locativeTitle: String { TurkishText.locative(title, afterPossessive: true) }
}
