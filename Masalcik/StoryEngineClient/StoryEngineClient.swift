import Foundation

/// İstemci tarafı masal motoru: profilden `StoryRequest` kurar, akışı tüketir, sonucu SwiftData'ya yazar.
/// Asıl üretim, güvenlik ve moderasyon backend'dedir (§4.4) — istemci yalnızca istek kurar ve sonucu saklar.
@MainActor
struct StoryEngineClient {
    let api: StoryAPI

    /// Profil + seçimlerden istek oluşturur. Son 5 masal başlığı tekrarı önlemek için gönderilir.
    static func makeRequest(child: ChildProfile, settings: AppSettings, region: Region, mood: StoryMood,
                            companion: CharacterID? = nil, value: ValueTopic? = nil,
                            language: AppLanguage = .current) -> StoryRequest {
        let recent = child.stories
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(5)
            .map(\.title)
        return StoryRequest(
            childName: child.name,
            childAge: child.age,
            pronunciation: child.pronunciation,
            interests: child.interests,
            value: value ?? child.values.first,
            companionCharacter: companion ?? child.companion,
            region: region,
            mood: mood,
            durationMinutes: settings.defaultDuration.rawValue,
            recurringCharacters: child.recurringCharacters
                .sorted { $0.appearances > $1.appearances }
                .prefix(3)
                .map { RecurringCharacterDTO(name: $0.name, card: $0.card) },
            recentStoryTitles: Array(recent),
            contentFilters: settings.contentFilters,
            voice: settings.voice,
            language: language)
    }

    /// DTO'yu kalıcı modele çevirir.
    static func makeStory(from dto: StoryDTO) -> Story {
        let story = Story(id: dto.id, title: dto.title, region: dto.coverScene.region, timeOfDay: dto.coverScene.timeOfDay,
                          mood: dto.mood, characters: dto.characters, moral: dto.moral,
                          durationMinutes: dto.durationMinutes)
        story.paragraphs = dto.paragraphs.map {
            StoryParagraph(index: $0.index, text: $0.text, sceneHint: $0.sceneHint, emotion: $0.emotion, audioURL: $0.audioUrl)
        }
        return story
    }
}
