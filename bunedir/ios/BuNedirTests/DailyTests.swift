import Foundation
import Testing
@testable import BuNedir

/// content/test-vectors.json'u (scripts/lib/daily.mjs üretir) Swift uygulamasıyla karşılaştırır.
struct DailyTests {
    struct Vector: Decodable { let date: String; let day: Int; let slot: Int; let kind: String; let no: Int; let daysAgo: Int; let image: String }
    struct File: Decodable { let vectors: [Vector] }

    static let vectors: [Vector] = {
        let url = Bundle.main.url(forResource: "test-vectors", withExtension: "json", subdirectory: "content")!
        return try! JSONDecoder().decode(File.self, from: Data(contentsOf: url)).vectors
    }()

    @Test func vektorlerJSIleAyni() {
        #expect(!Self.vectors.isEmpty)
        for v in Self.vectors {
            let p = v.date.split(separator: "-").map { Int($0)! }
            #expect(Daily.dayIndex(year: p[0], month: p[1], day: p[2], epoch: Content.shared.epoch) == v.day, "\(v.date)")
            let e = Daily.entry(day: v.day, slot: v.slot)
            #expect(e.kind.rawValue == v.kind && e.word.no == v.no && e.daysAgo == v.daysAgo && e.image == v.image, "\(v.date) dilim \(v.slot)")
        }
    }

    @Test func icerikPakette() {
        #expect(Content.words.count == 50)
        for w in Content.words {
            #expect(Content.image(w.cover, maxPixel: 64) != nil, "\(w.word) kapağı")
        }
    }

    @Test func dilimlerUcSaatArayla() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Istanbul")!
        let now = cal.date(from: DateComponents(year: 2026, month: 11, day: 9, hour: 14, minute: 20))!
        let starts = Daily.slotStarts(from: now, count: 9, calendar: cal)
        #expect(cal.component(.hour, from: starts[0]) == 12)
        #expect(cal.component(.hour, from: starts[1]) == 15)
        #expect(cal.component(.day, from: starts[8]) == 10)
        #expect(Daily.slot(for: now, calendar: cal) == 4)
    }

    @Test func sonKelimelerTekrarsiz() {
        let recent = Daily.recentWords(days: 14)
        #expect(recent.count == 14)
        #expect(Set(recent.map(\.no)).count == 14)
        #expect(recent.first == Daily.today())
    }
}
