import SwiftUI
import SwiftData

/// Hazine Sandığı (§3.6): çıkartmalar, kıyafetler, haftalık yıldızlar ve masal arkadaşları.
/// Nazik oyunlaştırma: yalnızca kazanılanlar ve "henüz"ler; ceza, kayıp ya da "seriyi kaybettin" yok.
struct TreasureChestView: View {
    var onClose: () -> Void = {}

    @Query private var families: [Family]
    @Environment(\.theme) private var theme

    private var child: ChildProfile? { families.first?.children.sorted { $0.createdAt < $1.createdAt }.first }

    var body: some View {
        ZStack {
            if theme.mode == .night { NightSkyBackground() } else { theme.background.ignoresSafeArea() }
            ScrollView {
                VStack(alignment: .leading, spacing: Metrics.spacingL) {
                    HStack {
                        BubbleButton(systemImage: "xmark", color: .grape, accessibilityLabel: "Kapat", action: onClose)
                        Spacer()
                    }
                    VoicePromptPlayer(text: String(localized: "Burası senin Hazine Sandığın! Dinlediğin her masal için bir çıkartma kazanırsın."),
                                      speaker: .pamuk, autoplay: true, showsText: true)
                    if let child {
                        WeekSection(child: child)
                        StickerSection(child: child)
                        OutfitSection(child: child)
                        FriendsSection(child: child)
                    }
                }
                .padding(Metrics.spacingM)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
        }
        .task {
            // Yeni işaretleri bir an görünsün, sonra "görüldü".
            try? await Task.sleep(for: .seconds(2))
            if let child { RewardEngine.markAllSeen(child) }
        }
    }
}

private struct SectionTitle: View {
    let text: String
    let symbol: String
    @Environment(\.theme) private var theme
    var body: some View {
        Label { Text(text) } icon: { Image(systemName: symbol) }
            .masalFont(.headline)
            .foregroundStyle(theme.ink)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Bu hafta: son 7 gecede masal dinlenen geceler + sıradaki kıyafete kalan gece (olumlu dil).
private struct WeekSection: View {
    let child: ChildProfile
    @Environment(\.theme) private var theme

    var body: some View {
        let nights = Set(child.listeningNights)
        let week = RewardRules.nightsInLastWeek(nights: nights, now: .now)
        let streak = RewardRules.consecutiveNights(nights: nights, now: .now)
        let toGo = 7 - streak % 7
        VStack(alignment: .leading, spacing: Metrics.spacingS) {
            SectionTitle(text: String(localized: "Bu hafta"), symbol: "star.fill")
            ProgressStars(filled: week, total: 7, starSize: 34)
            Text(String(localized: "Bu hafta \(week) gece masal dinledin."))
                .masalFont(.bodyBold).foregroundStyle(theme.ink)
            Text(String(localized: "Arka arkaya \(toGo) gece daha masal dinlersen yeni bir kıyafet kazanırsın!"))
                .masalFont(.body).foregroundStyle(theme.secondaryInk)
        }
    }
}

private struct StickerSection: View {
    let child: ChildProfile

    var body: some View {
        let stickers = child.stickers.filter { $0.kind == .sticker }.sorted { $0.earnedAt > $1.earnedAt }
        VStack(alignment: .leading, spacing: Metrics.spacingS) {
            SectionTitle(text: String(localized: "Çıkartmalarım"), symbol: "seal.fill")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 14)], spacing: 16) {
                ForEach(stickers) { s in
                    StickerView(key: s.assetKey, isEarned: true)
                        .overlay(alignment: .topTrailing) { if s.isNew { NewBadge() } }
                }
                // Sıradaki "henüz" çıkartmalar (soluk): hedef gibi, eksiklik gibi değil.
                ForEach(0..<max(0, 4 - stickers.count % 4), id: \.self) { i in
                    StickerView(key: StickerCatalog.all[(stickers.count + i) % StickerCatalog.all.count].key, isEarned: false)
                }
            }
        }
    }
}

private struct OutfitSection: View {
    let child: ChildProfile
    @Environment(\.theme) private var theme

    var body: some View {
        let owned = Set(child.stickers.filter { $0.kind == .outfit }.map(\.assetKey))
        VStack(alignment: .leading, spacing: Metrics.spacingS) {
            SectionTitle(text: String(localized: "Kıyafetler"), symbol: "tshirt.fill")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 12)], spacing: 16) {
                ForEach(Outfit.all) { outfit in
                    let has = owned.contains(outfit.key)
                    let worn = child.equippedOutfits[outfit.character.rawValue] == outfit.key
                    Button {
                        guard has else { return }
                        Feedback.tap()
                        // Dokun: giy / çıkar.
                        child.equippedOutfits[outfit.character.rawValue] = worn ? nil : outfit.key
                    } label: {
                        VStack(spacing: 2) {
                            CharacterView(character: outfit.character, mood: has ? .happy : .sleepy, size: 92,
                                          isInteractive: false, outfit: has ? outfit : nil)
                                .saturation(has ? 1 : 0)
                                .opacity(has ? 1 : 0.4)
                            Text(has ? outfit.title : String(localized: "Henüz"))
                                .masalFont(.caption, scales: false).lineLimit(2).multilineTextAlignment(.center)
                                .foregroundStyle(theme.ink)
                        }
                        .padding(6)
                        .background(RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous)
                            .fill(worn ? Palette.grass.opacity(0.35) : theme.surface.opacity(0.6)))
                        .overlay(RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous)
                            .strokeBorder(worn ? Palette.grass : theme.outline, lineWidth: worn ? 4 : 2))
                        .overlay(alignment: .topTrailing) {
                            if child.stickers.contains(where: { $0.kind == .outfit && $0.assetKey == outfit.key && $0.isNew }) { NewBadge() }
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(!has)
                    .accessibilityLabel(Text(has ? outfit.title : String(localized: "Henüz kazanılmadı")))
                    .accessibilityValue(worn ? Text("Giyiliyor") : Text(""))
                }
            }
        }
    }
}

/// Masal arkadaşları: masallarda doğan ve geri dönebilen karakterler (çocuğun hafızası).
private struct FriendsSection: View {
    let child: ChildProfile
    @Environment(\.theme) private var theme

    var body: some View {
        let friends = child.recurringCharacters.sorted { $0.appearances > $1.appearances }
        if !friends.isEmpty {
            VStack(alignment: .leading, spacing: Metrics.spacingS) {
                SectionTitle(text: String(localized: "Masal arkadaşların"), symbol: "person.2.fill")
                ForEach(friends) { f in
                    HStack(spacing: Metrics.spacingM) {
                        ZStack {
                            Circle().fill(AccentColor.sun.color(for: theme.mode))
                            RoundedStar().fill(.white).padding(14)
                        }
                        .frame(width: 56, height: 56)
                        .overlay(Circle().strokeBorder(theme.outline, lineWidth: 3))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(verbatim: f.name).masalFont(.bodyBold).foregroundStyle(theme.ink)
                            Text(verbatim: f.card).masalFont(.caption).foregroundStyle(theme.secondaryInk)
                            Text(String(localized: "\(f.appearances) masalda"))
                                .masalFont(.caption).foregroundStyle(theme.secondaryInk)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }
}

private struct NewBadge: View {
    var body: some View {
        Image(systemName: "sparkle").font(.system(size: 16, weight: .heavy))
            .foregroundStyle(Palette.berry)
            .padding(4).background(Circle().fill(.white))
            .offset(x: 6, y: -6)
            .accessibilityLabel(Text("Yeni"))
    }
}

#Preview("Hazine Sandığı") {
    TreasureChestView()
        .modelContainer(PersistenceController.preview.container)
        .themed(.day)
}
