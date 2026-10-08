import SwiftUI

/// Gündüz / Gece görsel modu (§2.2).
enum DisplayMode: String, Sendable {
    case day, night
}

/// Rol tabanlı tema. Ekranlar renkleri buradan okur; böylece mod değişince her şey birlikte döner.
struct Theme: Sendable {
    let mode: DisplayMode
    let background: Color
    let surface: Color
    let ink: Color          // metin + dış çizgi
    let secondaryInk: Color
    let outline: Color
    let primary: AccentColor
    let glow: Color         // sıcak ışık kaynakları (fener, pencere)

    static let day = Theme(
        mode: .day,
        background: Palette.cream,
        surface: .white,
        ink: Palette.ink,
        secondaryInk: Palette.ink.opacity(0.65),
        outline: Palette.ink,
        primary: .sun,
        glow: Palette.sun)

    static let night = Theme(
        mode: .night,
        background: Palette.nightSky,
        surface: Palette.dusk,
        ink: Palette.nightInk,
        secondaryInk: Palette.nightInk.opacity(0.7),
        // Gece dış çizgisi: koyu zeminde kaybolmasın diye lacivertin bir ton koyusu, metin açık renk.
        outline: Color(hex: "#14112F"),
        primary: .grape,
        glow: Palette.firefly)

    static func forMode(_ mode: DisplayMode) -> Theme { mode == .day ? .day : .night }
}

private struct ThemeKey: EnvironmentKey {
    static let defaultValue: Theme = .day
}

extension EnvironmentValues {
    var theme: Theme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}

extension View {
    /// Alt ağaca temayı uygular.
    func themed(_ mode: DisplayMode) -> some View {
        environment(\.theme, Theme.forMode(mode))
            .preferredColorScheme(mode == .night ? .dark : .light)
    }
}

/// Saat ve uyku saatinden görsel modu hesaplar.
enum DisplayModeResolver {
    /// VARSAYIM: Gece modu uyku saatinden 60 dk önce başlar (varsayılan 20:00 → 19:00) ve sabah 06:00'da biter.
    static let leadMinutes = 60
    static let morningHour = 6

    static func mode(for date: Date, bedtime: Bedtime, calendar: Calendar = .current) -> DisplayMode {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        let now = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        let nightStart = max(0, bedtime.hour * 60 + bedtime.minute - leadMinutes)
        let morning = morningHour * 60
        return (now >= nightStart || now < morning) ? .night : .day
    }
}
