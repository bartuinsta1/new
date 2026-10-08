import Testing
import Foundation
@testable import Masalcik

@Suite("Tasarım sistemi")
struct DesignSystemTests {
    private func date(_ h: Int, _ m: Int) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Istanbul")!
        return cal.date(from: DateComponents(year: 2026, month: 10, day: 8, hour: h, minute: m))!
    }

    private var istanbul: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Istanbul")!
        return cal
    }

    @Test func varsayilanUykuSaatindeGeceModu19dan() {
        #expect(DisplayModeResolver.mode(for: date(18, 59), bedtime: .default, calendar: istanbul) == .day)
        #expect(DisplayModeResolver.mode(for: date(19, 0), bedtime: .default, calendar: istanbul) == .night)
        #expect(DisplayModeResolver.mode(for: date(2, 0), bedtime: .default, calendar: istanbul) == .night)
        #expect(DisplayModeResolver.mode(for: date(6, 0), bedtime: .default, calendar: istanbul) == .day)
    }

    @Test func ebeveyninUykuSaatineUyar() {
        let early = Bedtime(hour: 19, minute: 30)
        #expect(DisplayModeResolver.mode(for: date(18, 30), bedtime: early, calendar: istanbul) == .night)
        #expect(DisplayModeResolver.mode(for: date(18, 29), bedtime: early, calendar: istanbul) == .day)
    }

    @Test func kararmaEgrisi() {
        #expect(DimmingCurve.dimming(forProgress: 0.3) == 0)
        #expect(abs(DimmingCurve.dimming(forProgress: 0.8) - 0.5) < 0.0001)
        #expect(DimmingCurve.dimming(forProgress: 1.0) >= 0.85)   // son %20'de neredeyse siyah
        #expect(DimmingCurve.dimming(forProgress: 2.0) == DimmingCurve.dimming(forProgress: 1.0))
    }

    @Test func gokyuzuDeterministik() {
        let a = NightSkyBackground.Star.generate(count: 10, seed: 7)
        let b = NightSkyBackground.Star.generate(count: 10, seed: 7)
        #expect(a.map(\.x) == b.map(\.x))
    }
}
