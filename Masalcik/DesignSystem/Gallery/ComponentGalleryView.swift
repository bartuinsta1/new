import SwiftUI

/// Tasarım sistemi galerisi: tüm tokenlar ve bileşenler, gündüz/gece anahtarıyla.
/// DEBUG derlemelerde Masal Adası'nda uzun basışla açılır; snapshot testleri de bu ekranı kullanır.
struct ComponentGalleryView: View {
    @State var mode: DisplayMode = .day

    var body: some View {
        ZStack {
            if mode == .night { NightSkyBackground() } else { Palette.cream.ignoresSafeArea() }
            ScrollView {
                VStack(alignment: .leading, spacing: Metrics.spacingL) {
                    header
                    section("Renkler") { swatches }
                    section("Tipografi") { typography }
                    section("BubbleButton") {
                        HStack(spacing: 16) {
                            BubbleButton("Masalı Başlat", systemImage: "play.fill", color: mode == .day ? .sun : .grape, size: .large) {}
                            BubbleButton(systemImage: "star.fill", color: .grape, accessibilityLabel: "Yıldız") {}
                        }
                    }
                    section("Karakterler") {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 104))], spacing: 8) {
                            ForEach(CharacterID.allCases) { c in
                                VStack(spacing: 0) {
                                    CharacterView(character: c, mood: mode == .night ? .sleepy : .happy, size: 96, speaksOnTap: false)
                                    Text(c.displayName).masalFont(.caption, scales: false).lineLimit(1)
                                }
                            }
                        }
                    }
                    section("Duygular — Pamuk") {
                        HStack { ForEach(CharacterMood.allCases, id: \.self) { CharacterView(character: .pamuk, mood: $0, size: 90, isInteractive: false) } }
                    }
                    section("StoryCard") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 16) {
                                StoryCard(title: "Ayşe ve Kayıp Fener", region: .whisperForest, durationMinutes: 10, characters: [.findik], isFavorite: true, width: 160)
                                StoryCard(title: "Keloğlan ile Sihirli Kaşık", region: .storytellerPlane, durationMinutes: 5, characters: [.nur], width: 160)
                                StoryCard(title: "Yıldız'ın İlk Gecesi", region: .starHill, durationMinutes: 15, characters: [.yildiz], isSleeping: true, width: 160)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    section("IslandRegionView + CloudLock") {
                        HStack(spacing: 0) {
                            IslandRegionView(region: .lighthouseCove, size: 130)
                            IslandRegionView(region: .starHill, isLocked: true, size: 130)
                        }
                    }
                    section("ProgressStars + StickerView") {
                        VStack(alignment: .leading, spacing: 12) {
                            ProgressStars(filled: 4)
                            HStack { ForEach(Array(StickerCatalog.all.prefix(4).enumerated()), id: \.offset) { i, s in StickerView(key: s.key, isEarned: i < 3, size: 64) } }
                        }
                    }
                    section("VoicePromptPlayer") {
                        VoicePromptPlayer(text: String(localized: "Masal seçmek için yıldıza dokun!"), autoplay: false, showsText: true)
                    }
                    section("Türkçe karakterler") {
                        Text(verbatim: "Çiğdem, Işıl, İpek, Ömür, Şule, Ülkü — ç ğ ı İ ö ş ü").masalFont(.headline)
                        Text(verbatim: TurkishText.uppercased("ıslak iğne, şirin ördek")).masalFont(.bodyBold)
                    }
                }
                .padding(Metrics.spacingM)
                .foregroundStyle(Theme.forMode(mode).ink)
            }
        }
        .themed(mode)
    }

    private var header: some View {
        HStack {
            Text("\(AppConfig.appName) Tasarım Sistemi").masalFont(.title)
            Spacer()
            Picker("Mod", selection: $mode) {
                Text("Gündüz").tag(DisplayMode.day)
                Text("Gece").tag(DisplayMode.night)
            }
            .pickerStyle(.segmented)
            .frame(width: 160)
        }
    }

    private func section<C: View>(_ title: LocalizedStringKey, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: Metrics.spacingS) {
            Text(title).masalFont(.headline)
            content()
        }
    }

    private var swatches: some View {
        let day: [(String, Color)] = [("sky", Palette.sky), ("grass", Palette.grass), ("sun", Palette.sun), ("berry", Palette.berry),
                                      ("grape", Palette.grape), ("orange", Palette.orange), ("ink", Palette.ink), ("cream", Palette.cream)]
        let night: [(String, Color)] = [("nightSky", Palette.nightSky), ("dusk", Palette.dusk), ("moon", Palette.moon),
                                        ("firefly", Palette.firefly), ("nightInk", Palette.nightInk)]
        return LazyVGrid(columns: [GridItem(.adaptive(minimum: 72))], spacing: 8) {
            ForEach(Array((mode == .day ? day : night).enumerated()), id: \.offset) { _, swatch in
                let (name, color) = swatch
                VStack(spacing: 2) {
                    VStack(spacing: 0) {
                        color
                        color.darkened(0.2).frame(height: 10)
                    }
                    .frame(height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.forMode(mode).outline, lineWidth: 3))
                    Text(verbatim: name).masalFont(.caption, scales: false)
                }
            }
        }
    }

    private var typography: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Bir varmış bir yokmuş").masalFont(.display)
            Text("Masal Adası'na hoş geldin!").masalFont(.title)
            Text("Fısıltı Ormanı").masalFont(.headline)
            Text("Pamuk uzun uzun esnemiş ve gözlerini yavaşça kapamış.").masalFont(.body)
        }
    }
}

#Preview("Galeri — Gündüz") { ComponentGalleryView(mode: .day) }
#Preview("Galeri — Gece") { ComponentGalleryView(mode: .night) }
