import Foundation
import SwiftData
import Observation

/// "Bu Gece" akışının durumu (§3.3): karşılama → Kim? → Nerede? → Ne? → masal yazılıyor → oynatıcı.
@MainActor
@Observable
final class TonightModel {
    enum Step: Equatable {
        case greeting, character, region, mood
        case generating
        case playing
        /// Günlük yeni masal hakkı doldu: çocuğa satın alma değil, kitaplıktan masal önerilir.
        case libraryOffer
    }

    private(set) var step: Step = .greeting
    private(set) var character: CharacterID?
    private(set) var region: Region?
    private(set) var mood: StoryMood?
    /// Bekleme ekranında gösterilecek başlık (sunucu "started" gönderince).
    private(set) var title: String?
    private(set) var player: StoryPlayerModel?
    /// Yerel güvenli masala düşüldü mü (ağ yok / sunucu hatası).
    private(set) var usedLocalFallback = false

    let characterOptions: [CharacterID]
    let regionOptions: [Region]
    let moodOptions: [StoryMood]

    @ObservationIgnored private let api: StoryAPI
    @ObservationIgnored private let context: ModelContext
    @ObservationIgnored private let child: ChildProfile?
    @ObservationIgnored private let settings: AppSettings
    @ObservationIgnored private let language: AppLanguage
    @ObservationIgnored private let unlocked: [Region]
    @ObservationIgnored private let seed: UInt64
    @ObservationIgnored private var streamTask: Task<Void, Never>?
    /// Aynı gece içinde tekrar denemede sunucu masalı yeniden üretmesin ve kota düşmesin.
    @ObservationIgnored private let idempotencyKey = UUID().uuidString
    /// Zaman aşımı: bu sürede hiç paragraf gelmezse yerel masala geçilir (çocuk sonsuza dek beklemez).
    @ObservationIgnored var firstParagraphTimeout: Duration = .seconds(45)

    init(api: StoryAPI, context: ModelContext, child: ChildProfile?, settings: AppSettings?,
         isBedtimeNear: Bool, language: AppLanguage = .current, now: Date = .now) {
        self.api = api
        self.context = context
        self.child = child
        self.settings = settings ?? AppSettings()
        self.language = language
        let listened = child?.listenedStoryCount ?? 0
        let hasValues = !(child?.values.isEmpty ?? true)
        let unlocked = Region.storyRegions.filter {
            RegionUnlocks.isUnlocked($0, listenedStories: listened, hasValueTopics: hasValues)
        }
        let seed = TonightOptions.seed(date: now, childID: child?.id ?? UUID())
        self.unlocked = unlocked
        self.seed = seed
        let companion = child?.companion ?? .pamuk
        characterOptions = TonightOptions.characters(companion: companion, seed: seed)
        regionOptions = TonightOptions.regions(unlocked: unlocked, interests: child?.interests ?? [], seed: seed)
        moodOptions = TonightOptions.moods(isBedtimeNear: isBedtimeNear)
    }

    var childName: String? { child?.name }

    /// 1–3 seçim adımı için nokta göstergesi.
    var choiceIndex: Int {
        switch step {
        case .character: 1
        case .region: 2
        case .mood: 3
        default: 0
        }
    }

    // MARK: Seçimler

    func begin() { if step == .greeting { step = .character } }

    func choose(_ c: CharacterID) {
        character = c
        VoicePrompter.shared.speak(c.displayName)
        step = .region
    }

    func choose(_ r: Region) {
        region = r
        VoicePrompter.shared.speak(r.title)
        step = .mood
    }

    func choose(_ m: StoryMood) {
        mood = m
        VoicePrompter.shared.speak(m.title)
        startGenerating()
    }

    /// "Pamuk seçsin": tek dokunuş.
    func letPamukChoose() {
        let picks = TonightOptions.pamukPicks(companion: child?.companion ?? .pamuk, unlocked: unlocked,
                                              interests: child?.interests ?? [], seed: seed)
        character = picks.character
        region = picks.region
        mood = picks.mood
        startGenerating()
    }

    func back() {
        switch step {
        case .region: step = .character
        case .mood: step = .region
        case .character: step = .greeting
        default: break
        }
    }

    // MARK: Üretim

    func startGenerating() {
        guard let character, let region, let mood, streamTask == nil else { return }
        step = .generating
        let request: StoryRequest
        if let child {
            request = StoryEngineClient.makeRequest(child: child, settings: settings, region: region, mood: mood,
                                                    companion: character, language: language)
        } else {
            var r = MockStoryAPI.previewRequest(language: language)
            r.companionCharacter = character; r.region = region; r.mood = mood
            request = r
        }
        streamTask = Task { [weak self] in await self?.consume(request) }
    }

    /// Kitaplıktan kayıtlı masal: yeniden üretim yok, kayıttan (indirilmişse çevrimdışı) çalar.
    func playStored(_ story: Story) {
        streamTask?.cancel()
        streamTask = nil
        player = StoryPlayerModel(story: story, child: child, settings: settings, language: language)
        step = .playing
    }

    func cancel() {
        streamTask?.cancel()
        streamTask = nil
        player?.close()
    }

    private func consume(_ request: StoryRequest) async {
        let timeout = Task { [weak self, firstParagraphTimeout] in
            try? await Task.sleep(for: firstParagraphTimeout)
            guard !Task.isCancelled else { return }
            await self?.timedOut(request)
        }
        defer { timeout.cancel() }
        do {
            for try await event in api.generateStory(request, idempotencyKey: idempotencyKey) {
                if Task.isCancelled || usedLocalFallback { return }
                switch event {
                case .progress:
                    break
                case .started(let id, let title, let cover):
                    self.title = title
                    startPlayer(id: id, title: title, region: cover.region, request: request)
                case .paragraph(let p):
                    if player == nil { startPlayer(id: UUID().uuidString, title: title ?? "", region: request.region, request: request) }
                    player?.appendStreamed(p)
                    timeout.cancel()
                    // İlk paragraf geldi: oynatıcıya geç; ses hemen başlar.
                    if step == .generating { step = .playing }
                case .completed(let dto):
                    finalize(with: dto)
                }
            }
        } catch {
            guard !Task.isCancelled else { return }
            handle(error, request: request)
        }
    }

    private func timedOut(_ request: StoryRequest) {
        guard step == .generating, player == nil || player?.story.paragraphs.isEmpty == true else { return }
        streamTask?.cancel()
        playLocalFallback(request)
    }

    private func handle(_ error: Error, request: StoryRequest) {
        // Masal çoktan çalmaya başladıysa akış hatası çocuğu etkilemez: elimizdeki paragraflarla biter.
        if step == .playing {
            player?.streamCompleted()
            return
        }
        switch TonightFailurePolicy.action(for: error) {
        case .showLibraryOffer:
            VoicePrompter.shared.speak(TonightLines.libraryOffer)
            step = .libraryOffer
        case .playLocalFallback:
            playLocalFallback(request)
        }
    }

    /// Cihazdaki güvenli, önceden yazılmış masal (yalnızca doğrulanmış ad yerleşir).
    private func playLocalFallback(_ request: StoryRequest) {
        usedLocalFallback = true
        player?.close()
        let story = StoryEngineClient.makeStory(from: MockStoryAPI.sampleStory(for: request))
        context.insert(story)
        child?.stories.append(story)
        player = StoryPlayerModel(story: story, child: child, settings: settings, language: language)
        step = .playing
    }

    private func startPlayer(id: String, title: String, region: Region, request: StoryRequest) {
        guard player == nil else { return }
        let story = Story(id: id, title: title, region: region, mood: request.mood,
                          characters: [request.companionCharacter], durationMinutes: request.durationMinutes)
        context.insert(story)
        child?.stories.append(story)
        let model = StoryPlayerModel(story: story, child: child, settings: settings, language: language)
        model.isCompleteStory = false
        player = model
    }

    private func finalize(with dto: StoryDTO) {
        guard let player else {
            // Paragraf gelmeden tamamlandı (beklenmez): masalı tümüyle kur ve çal.
            let story = StoryEngineClient.makeStory(from: dto)
            context.insert(story)
            child?.stories.append(story)
            self.player = StoryPlayerModel(story: story, child: child, settings: settings, language: language)
            step = .playing
            return
        }
        let story = player.story
        story.title = dto.title
        story.characters = dto.characters
        story.moral = dto.moral
        story.timeOfDay = dto.coverScene.timeOfDay
        // Akış sırasında kaçan paragraf olduysa tamamla.
        let known = Set(story.paragraphs.map(\.index))
        for p in dto.paragraphs where !known.contains(p.index) { player.appendStreamed(p) }
        // Ses URL'leri sonradan geldiyse (çevrimdışı indirme için) güncelle.
        for p in story.paragraphs {
            if p.audioURL == nil, let url = dto.paragraphs.first(where: { $0.index == p.index })?.audioUrl { p.audioURL = url }
        }
        if let new = dto.newRecurringCharacter { remember(new, storyID: story.id) }
        player.streamCompleted()
        try? context.save()
    }

    /// Çocuğun hafızası: masalda doğan karakter sonraki masallarda geri dönebilir (§4.3).
    private func remember(_ c: RecurringCharacterDTO, storyID: String) {
        guard let child else { return }
        let key = TurkishText.lowercased(c.name.trimmingCharacters(in: .whitespaces))
        if let existing = child.recurringCharacters.first(where: { TurkishText.lowercased($0.name) == key }) {
            existing.appearances += 1
        } else {
            child.recurringCharacters.append(RecurringCharacter(name: c.name, card: c.card, firstStoryID: storyID))
        }
    }
}

/// "Bu Gece" sesli yönergeleri (TR + EN String Catalog).
enum TonightLines {
    static func greeting(name: String?) -> String {
        if let name { return String(localized: "Hoş geldin \(name)! Bu gece nasıl bir masal dinlemek istersin?") }
        return String(localized: "Hoş geldin! Bu gece nasıl bir masal dinlemek istersin?")
    }
    static var who: String { String(localized: "Kim olsun?") }
    static var whereTo: String { String(localized: "Nerede geçsin?") }
    static var what: String { String(localized: "Ne olsun?") }
    static var pamukChooses: String { String(localized: "Pamuk seçsin") }
    static var writing: String { String(localized: "Masalını yazıyorum… İstersen gözlerini kapatabilirsin.") }
    /// Satın almadan söz etmez (§2.3): çocuğu kitaplığa yönlendirir.
    static var libraryOffer: String { String(localized: "Bu gecenin yeni masalı uyuyor. Kitaplıktan sevdiğin bir masalı dinleyelim mi?") }
}
