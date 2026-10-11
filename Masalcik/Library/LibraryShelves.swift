import Foundation

/// Kitaplık rafları (§3.5). Saf mantık; testli.
enum LibraryShelves {
    struct Shelf: Identifiable {
        enum Kind: String { case favorites, mine, library }
        let kind: Kind
        let stories: [Story]
        var id: String { kind.rawValue }
    }

    /// Favoriler (kalpli raf) → benim masallarım → kitaplık masalları. Yalnızca dinlenmiş masallar;
    /// her rafta en son dinlenen önde. Boş raflar gösterilmez.
    static func shelves(from stories: [Story]) -> [Shelf] {
        let listened = stories.filter { $0.playCount > 0 && !$0.paragraphs.isEmpty }
            .sorted { ($0.lastPlayedAt ?? $0.createdAt) > ($1.lastPlayedAt ?? $1.createdAt) }
        let shelves = [
            Shelf(kind: .favorites, stories: listened.filter(\.isFavorite)),
            Shelf(kind: .mine, stories: listened.filter { !$0.isFavorite && !$0.isLibraryStory }),
            Shelf(kind: .library, stories: listened.filter { !$0.isFavorite && $0.isLibraryStory }),
        ]
        return shelves.filter { !$0.stories.isEmpty }
    }
}

extension LibraryShelves.Shelf.Kind {
    var title: String {
        switch self {
        case .favorites: String(localized: "Favorilerim")
        case .mine: String(localized: "Benim masallarım")
        case .library: String(localized: "Kitaplık masalları")
        }
    }
    var symbol: String {
        switch self {
        case .favorites: "heart.fill"
        case .mine: "sparkles"
        case .library: "books.vertical.fill"
        }
    }
}
