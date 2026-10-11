import SwiftUI
import SwiftData

/// Kitaplık (§3.5): dinlenen masallar raflarda kapak kartı olarak; favoriler kalpli ayrı rafta.
/// Her masal tekrar dinlenebilir — kayıttan (ve indirilmişse çevrimdışı), yeniden üretim yok.
struct LibraryView: View {
    var onPlay: (Story) -> Void
    var onClose: () -> Void

    @Query private var families: [Family]
    @Environment(\.theme) private var theme

    private var child: ChildProfile? { families.first?.children.sorted { $0.createdAt < $1.createdAt }.first }
    private var shelves: [LibraryShelves.Shelf] { LibraryShelves.shelves(from: child?.stories ?? []) }

    var body: some View {
        ZStack {
            if theme.mode == .night { NightSkyBackground() } else { theme.background.ignoresSafeArea() }
            VStack(spacing: Metrics.spacingM) {
                HStack {
                    BubbleButton(systemImage: "xmark", color: .grape, accessibilityLabel: "Kapat", action: onClose)
                    Spacer()
                    Image(systemName: "books.vertical.fill").font(.system(size: 30, weight: .heavy))
                        .foregroundStyle(theme.ink)
                        .accessibilityHidden(true)
                    Spacer()
                    Color.clear.frame(width: Metrics.minTapTarget, height: Metrics.minTapTarget)
                }
                .padding(.horizontal, Metrics.spacingM)

                if shelves.isEmpty {
                    Spacer()
                    CharacterView(character: .pamuk, mood: .sleepy, size: 160)
                    VoicePromptPlayer(text: String(localized: "Kitaplığın şimdilik boş. Dinlediğin her masal buraya, rafına gelir!"),
                                      speaker: .pamuk, autoplay: true, showsText: true)
                        .padding(.horizontal)
                    Spacer()
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Metrics.spacingL) {
                            ForEach(shelves) { shelf in shelfView(shelf) }
                        }
                        .padding(.vertical, Metrics.spacingM)
                    }
                }
            }
        }
    }

    private func shelfView(_ shelf: LibraryShelves.Shelf) -> some View {
        VStack(alignment: .leading, spacing: Metrics.spacingS) {
            Label { Text(shelf.kind.title) } icon: { Image(systemName: shelf.kind.symbol) }
                .masalFont(.headline)
                .foregroundStyle(shelf.kind == .favorites ? Palette.berry : theme.ink)
                .padding(.horizontal, Metrics.spacingM)
                .accessibilityAddTraits(.isHeader)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: Metrics.spacingM) {
                    ForEach(shelf.stories) { story in
                        ShelfCard(story: story, onPlay: { onPlay(story) })
                    }
                }
                .padding(.horizontal, Metrics.spacingM)
                .padding(.bottom, Metrics.spacingS)
            }
            // Raf tahtası
            RoundedRectangle(cornerRadius: 6).fill(Color(hex: "#C98F4E").opacity(theme.mode == .day ? 1 : 0.6))
                .frame(height: 12)
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(theme.outline, lineWidth: 2))
                .padding(.horizontal, Metrics.spacingS)
                .offset(y: -Metrics.spacingS)
                .accessibilityHidden(true)
        }
    }
}

/// Raftaki kart: dokununca dinle, kalbe dokununca favori.
private struct ShelfCard: View {
    @Bindable var story: Story
    var onPlay: () -> Void

    var body: some View {
        Button(action: onPlay) {
            StoryCard(title: story.title, region: story.region, durationMinutes: story.durationMinutes,
                      characters: Array(story.characters.prefix(1)), isFavorite: story.isFavorite, width: 150)
        }
        .buttonStyle(.plain)
        .overlay(alignment: .bottomTrailing) {
            Button {
                Feedback.tap()
                story.isFavorite.toggle()
            } label: {
                Image(systemName: story.isFavorite ? "heart.fill" : "heart")
                    .font(.system(size: 20, weight: .heavy))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(BubbleButtonStyle(color: .berry, shape: .circle))
            .offset(x: 6, y: -60)   // kapak resminin sağ alt köşesi; başlığın üstüne binmez
            .accessibilityLabel(story.isFavorite ? Text("Favorilerden çıkar") : Text("Favorilere ekle"))
        }
        .accessibilityHint(Text("Masalı dinlemek için dokun"))
    }
}

#Preview("Kitaplık") {
    LibraryView(onPlay: { _ in }, onClose: {})
        .modelContainer(PersistenceController.preview.container)
        .themed(.night)
}
