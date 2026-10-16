import Testing
import SwiftUI
@testable import Masalcik

/// Renk belirteçlerinin WCAG AA kontrastı. Yeni renk eklenince burada da yer almalı.
@Suite("Erişilebilirlik — kontrast")
struct ContrastTests {
    @Test(arguments: [Theme.day, Theme.night])
    func metinZemindeOkunur(theme: Theme) {
        for bg in [theme.background, theme.surface] {
            #expect(Contrast.ratio(theme.ink, on: bg) >= Contrast.normalText)
            #expect(Contrast.ratio(theme.secondaryInk, on: bg) >= Contrast.normalText)
        }
    }

    /// Buton yazısı her vurgu renginde, iki modda da okunur (gece: koyu yazı, soluk dolgu).
    @Test(arguments: [DisplayMode.day, .night])
    func butonYazilari(mode: DisplayMode) {
        let label = mode == .day ? Palette.ink : Palette.nightOnAccent
        for accent in AccentColor.allCases {
            let ratio = Contrast.ratio(label, on: accent.color(for: mode))
            // Mor dolgu gündüz 3,5: buton yazıları büyük ve kalın (≥ 22 pt) olduğundan büyük metin eşiği yeter.
            #expect(ratio >= Contrast.largeText, "\(accent) \(mode): \(ratio)")
            if accent != .grape { #expect(ratio >= Contrast.normalText, "\(accent) \(mode): \(ratio)") }
        }
    }

    @Test func morMetinBeyazdaOkunur() {
        #expect(Contrast.ratio(Palette.grapeText, on: .white) >= Contrast.normalText)
        #expect(Contrast.ratio(Palette.grapeText, on: Palette.cream) >= Contrast.normalText)
    }

    @Test func karaokeOkunmamisKelimeler() {
        #expect(Contrast.ratio(Palette.nightInk.opacity(0.6), on: Palette.nightSky) >= Contrast.normalText)
        #expect(Contrast.ratio(Palette.moon, on: Palette.nightSky) >= Contrast.normalText)
    }

    @Test func oranDogru() {
        #expect(abs(Contrast.ratio(.black, on: .white) - 21) < 0.01)
        #expect(abs(Contrast.ratio(.white, on: .white) - 1) < 0.01)
    }
}

@Suite("Erişilebilirlik — dokunma alanları")
struct TapTargetTests {
    /// Çocuk tarafı: Apple'ın 44 pt alt sınırının çok üstünde (küçük parmaklar, uykulu eller).
    @Test func cocukDugmeleriBuyuk() {
        #expect(Metrics.minTapTarget >= 64)
        #expect(Metrics.primaryTapTarget >= 96)
        #expect(BubbleButton.Size.regular.side >= 44)
    }
}
