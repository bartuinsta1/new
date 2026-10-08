import Foundation
import SwiftData

/// SwiftData kapsayıcısı.
@MainActor
final class PersistenceController {
    static let shared = PersistenceController()
    static let preview = PersistenceController(inMemory: true, seed: true)

    static let schema = Schema([
        Family.self, ChildProfile.self, Story.self, StoryParagraph.self,
        RecurringCharacter.self, Sticker.self, AppSettings.self, Entitlement.self,
    ])

    let container: ModelContainer

    init(inMemory: Bool = false, seed: Bool = false) {
        let config = ModelConfiguration(schema: Self.schema, isStoredInMemoryOnly: inMemory)
        do {
            container = try ModelContainer(for: Self.schema, configurations: [config])
        } catch {
            // Kalıcı depo açılamazsa çocuk hata ekranı görmesin: bellek içi depoyla devam et.
            // Bir sonraki sürümde migrasyon planı eklenecek.
            container = try! ModelContainer(for: Self.schema,
                                            configurations: [ModelConfiguration(isStoredInMemoryOnly: true)])
        }
        if seed { Self.seedPreviewData(into: container.mainContext) }
    }

    /// Preview ve testler için örnek aile.
    static func seedPreviewData(into context: ModelContext) {
        let family = Family(hasCompletedOnboarding: true)
        family.settings = AppSettings()
        family.entitlement = Entitlement()
        let child = ChildProfile(name: "Ayşe", age: 5, interests: [.animals, .space], values: [.sharing],
                                 companion: .findik)
        family.children.append(child)
        let story = Story(id: "preview-1", title: "Ayşe ve Uykucu Yıldız", region: .starHill, mood: .calm,
                          characters: [.pamuk, .yildiz], moral: "Paylaşmak sevinci büyütür.", durationMinutes: 10)
        story.paragraphs = [
            StoryParagraph(index: 0, text: "Bir varmış bir yokmuş, Yıldız Tepesi'nde Ayşe adında bir kız yaşarmış.",
                           sceneHint: "star_hill_dusk", emotion: .smiling),
            StoryParagraph(index: 1, text: "Gökten üç elma düşmüş: biri Ayşe'ye, biri Pamuk'a, biri de bu masalı dinleyene.",
                           sceneHint: "star_hill_night", emotion: .sleepy),
        ]
        child.stories.append(story)
        context.insert(family)
    }
}
