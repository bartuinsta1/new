import SwiftUI

/// Masal kartı: kapak illüstrasyonu + süre rozeti (+ isteğe bağlı başlık, favori kalbi).
/// Kilitli (ücretli) içerikte kilit yerine `CloudLock` gösterilir (§2.3).
struct StoryCard: View {
    let title: String
    let region: Region
    let durationMinutes: Int
    var characters: [CharacterID] = []
    var isFavorite = false
    var isSleeping = false
    var showsTitle = true
    var width: CGFloat = 180

    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            cover
                .frame(height: width * 0.78)
                .clipped()
            if showsTitle {
                Text(title)
                    .masalFont(.bodyBold, scales: false)
                    .foregroundStyle(theme.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .padding(.horizontal, Metrics.spacingS)
                    .background(theme.surface)
            }
        }
        .frame(width: width)
        .clipShape(RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous)
            .strokeBorder(theme.outline, lineWidth: Metrics.outlineWidth))
        .background(
            RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous)
                .fill(region.accent.shadow(for: theme.mode))
                .offset(y: Metrics.pressDepth))
        .padding(.bottom, Metrics.pressDepth)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("\(title), \(durationMinutes) dakika"))
    }

    private var cover: some View {
        ZStack {
            RegionBackdrop(region: region)
            if let lead = characters.first {
                CharacterView(character: lead, mood: theme.mode == .night ? .sleepy : .happy,
                              size: width * 0.6, isInteractive: false)
                    .offset(y: width * 0.06)
            }
            if isSleeping {
                Rectangle().fill(.ultraThinMaterial)
                CloudLock(size: width * 0.62)
            }
        }
        .overlay(alignment: .topTrailing) {
            DurationBadge(minutes: durationMinutes).padding(Metrics.spacingS)
        }
        .overlay(alignment: .topLeading) {
            if isFavorite {
                Image(systemName: "heart.fill")
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundStyle(Palette.berry)
                    .padding(Metrics.spacingS)
                    .accessibilityLabel(Text("Favori"))
            }
        }
    }
}

/// "10 dk" rozeti.
struct DurationBadge: View {
    let minutes: Int
    @Environment(\.theme) private var theme

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "moon.fill").font(.system(size: 11, weight: .heavy))
            Text("\(minutes) dk").masalFont(.caption, scales: false)
        }
        .foregroundStyle(Palette.ink)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Capsule().fill(theme.mode == .day ? Palette.sun : Palette.moon))
        .overlay(Capsule().strokeBorder(theme.outline, lineWidth: 2))
    }
}

/// Bölgeye özgü yer tutucu sahne (kapaklar ve harita için). Gerçek illüstrasyonlarla değiştirilecek.
struct RegionBackdrop: View {
    let region: Region
    @Environment(\.theme) private var theme

    var body: some View {
        let base = region.accent.color(for: theme.mode)
        ZStack {
            LinearGradient(colors: theme.mode == .day
                           ? [Palette.sky.opacity(0.55), base.opacity(0.85)]
                           : [Palette.nightSky, Palette.dusk.opacity(0.9), base.opacity(0.6)],
                           startPoint: .top, endPoint: .bottom)
            // Tepe silueti
            Ellipse().fill(base.darkened(0.15))
                .frame(width: 320, height: 140)
                .offset(y: 70)
            if theme.mode == .night {
                Circle().fill(Palette.moon).frame(width: 22).offset(x: 50, y: -40)
            } else {
                Circle().fill(Palette.sun).frame(width: 28).offset(x: -55, y: -40)
            }
        }
    }
}

#Preview("StoryCard") {
    HStack(spacing: 16) {
        StoryCard(title: "Ayşe ve Kayıp Fener", region: .whisperForest, durationMinutes: 10,
                  characters: [.findik], isFavorite: true)
        StoryCard(title: "Yıldız'ın İlk Gecesi", region: .starHill, durationMinutes: 15,
                  characters: [.yildiz], isSleeping: true)
    }
    .padding()
    .background(Palette.cream)
    .themed(.day)
}

#Preview("StoryCard — Gece") {
    StoryCard(title: "Kaptan Midye ve Şarkı Söyleyen Deniz", region: .lighthouseCove, durationMinutes: 10,
              characters: [.kaptanMidye])
        .padding()
        .background(Palette.nightSky)
        .themed(.night)
}
