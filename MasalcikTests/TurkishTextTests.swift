import Testing
@testable import Masalcik

@Suite("Türkçe metin")
struct TurkishTextTests {
    @Test func noktaliVeNoktasizI() {
        #expect(TurkishText.uppercased("istanbul ılık") == "İSTANBUL ILIK")
        #expect(TurkishText.lowercased("İSTANBUL IŞIK") == "istanbul ışık")
        #expect(TurkishText.uppercased("çiğdem şule ömür ülkü") == "ÇİĞDEM ŞULE ÖMÜR ÜLKÜ")
    }

    @Test(arguments: [
        ("Ayşe", "Ayşe'ye"), ("Mert", "Mert'e"), ("Fındık", "Fındık'a"), ("Ali", "Ali'ye"),
        ("Kaptan Midye", "Kaptan Midye'ye"), ("Doğa", "Doğa'ya"), ("Işık", "Işık'a"), ("İpek", "İpek'e"),
    ])
    func yonelmeHali(name: String, expected: String) {
        #expect(TurkishText.dative(name) == expected)
    }

    @Test(arguments: [
        ("Ayşe", "Ayşe'de"), ("Mert", "Mert'te"), ("Ömür", "Ömür'de"), ("Kitap", "Kitap'ta"),
    ])
    func bulunmaHali(name: String, expected: String) {
        #expect(TurkishText.locative(name) == expected)
    }

    @Test func bolgeAdlariKaynastirmaAlir() {
        #expect(Region.whisperForest.locativeTitle(in: .tr) == "Fısıltı Ormanı'nda")
        #expect(Region.starHill.locativeTitle(in: .tr) == "Yıldız Tepesi'nde")
        #expect(Region.lighthouseCove.locativeTitle(in: .tr) == "Deniz Feneri Koyu'nda")
        #expect(Region.feelingsGarden.locativeTitle(in: .tr) == "Duygu Bahçesi'nde")
    }

    @Test func bolgeAdlariIngilizce() {
        #expect(Region.whisperForest.locativeTitle(in: .en) == "in Whisper Forest")
        #expect(Region.starHill.locativeTitle(in: .en) == "on Star Hill")
        #expect(Region.storytellerPlane.locativeTitle(in: .en) == "under the Storyteller Tree")
        #expect(Region.feelingsGarden.locativeTitle(in: .en) == "in the Feelings Garden")
    }

    @Test func iyelikliYonelme() {
        #expect(TurkishText.dative("Fısıltı Ormanı", afterPossessive: true) == "Fısıltı Ormanı'na")
        #expect(TurkishText.dative("Duygu Bahçesi", afterPossessive: true) == "Duygu Bahçesi'ne")
    }

    @Test(arguments: [
        (0, "zero"), (7, "seven"), (13, "thirteen"), (40, "forty"), (63, "sixty-three"),
        (100, "one hundred"), (115, "one hundred fifteen"), (999, "nine hundred ninety-nine"),
    ])
    func ingilizceSayilar(n: Int, expected: String) {
        #expect(EnglishText.numberWords(n) == expected)
    }

    @Test(arguments: [
        ("Ayşe", "Ayşe'nin"), ("Mert", "Mert'in"), ("Pamuk", "Pamuk'un"), ("Ömür", "Ömür'ün"), ("Işıl", "Işıl'ın"),
    ])
    func ilgiHali(name: String, expected: String) {
        #expect(TurkishText.genitive(name) == expected)
    }

    @Test(arguments: [
        (0, "sıfır"), (7, "yedi"), (10, "on"), (63, "altmış üç"), (99, "doksan dokuz"),
        (100, "yüz"), (205, "iki yüz beş"), (48, "kırk sekiz"),
    ])
    func sayilarYaziyla(n: Int, expected: String) {
        #expect(TurkishText.numberWords(n) == expected)
    }
}
