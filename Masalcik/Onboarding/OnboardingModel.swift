import Foundation
import Observation
import SwiftData

/// Onboarding akışının durumu ve kuralları (§3.1). Ebeveynle birlikte, en fazla 6 görünür adım.
///
/// 1 Karşılama → 2 Ebeveyn kapısı + ebeveyn bilgisi → 3 Çocuğun adı ve yaşı → 4 İlgi alanları
/// → 5 Değerler/gündem (isteğe bağlı) → 6 Avatar + yoldaş → kutlama → doğrudan ilk masal.
/// Sonunda paywall YOK.
@MainActor
@Observable
final class OnboardingModel {
    enum Step: Int, CaseIterable, Comparable {
        case welcome, parentGate, parentInfo, childInfo, interests, values, avatar, finale

        static func < (a: Step, b: Step) -> Bool { a.rawValue < b.rawValue }

        /// İlerleme noktalarında gösterilen 1…6 numarası (kapı ve ebeveyn bilgisi aynı adımdır).
        var visibleIndex: Int {
            switch self {
            case .welcome: 1
            case .parentGate, .parentInfo: 2
            case .childInfo: 3
            case .interests: 4
            case .values: 5
            case .avatar, .finale: 6
            }
        }

        /// Ekranı ebeveyn mi kullanıyor? Ebeveyn adımları Dynamic Type ile ölçeklenen, daha yoğun düzende çizilir.
        var isParentFacing: Bool { self == .parentGate || self == .parentInfo || self == .childInfo || self == .values }
    }

    static let visibleStepCount = 6
    static let ageRange = 3...9

    private(set) var step: Step = .welcome
    /// Kapı bir kez geçildiyse geri gidip tekrar ileri gelindiğinde yeniden sorulmaz.
    private(set) var hasPassedParentGate = false

    // Ebeveyn bilgisi
    var childCount = 1 { didSet { childCount = min(max(childCount, 1), AppConfig.maxChildProfiles) } }
    var bedtime: Bedtime = .default

    // Çocuk
    var childName = ""
    var childAge: Int? = nil
    var pronunciation = ""
    private(set) var interests: [Interest] = []
    private(set) var values: Set<ValueTopic> = []

    // Avatar
    var avatar: AvatarConfig = .default
    var companion: CharacterID = .pamuk

    // MARK: Doğrulama

    /// Ad: harf, boşluk, kesme ve tire; 1–30 karakter (backend `NAME_RE` ile aynı kural).
    /// Rakam, emoji ve sembol kabul edilmez — masal istemine giden serbest metni en baştan daraltır.
    static func isValidName(_ raw: String) -> Bool {
        let name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...30).contains(name.count), let first = name.unicodeScalars.first,
              CharacterSet.letters.contains(first) else { return false }
        let allowed = CharacterSet.letters.union(CharacterSet(charactersIn: " '’-"))
        return name.unicodeScalars.allSatisfy { allowed.contains($0) }
    }

    /// Telaffuz: boş olabilir; doluysa harf, boşluk, tire, kesme; en fazla 40 karakter.
    static func isValidPronunciation(_ raw: String) -> Bool {
        let p = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if p.isEmpty { return true }
        guard p.count <= 40 else { return false }
        let allowed = CharacterSet.letters.union(CharacterSet(charactersIn: " '’-·"))
        return p.unicodeScalars.allSatisfy { allowed.contains($0) }
    }

    var trimmedName: String { childName.trimmingCharacters(in: .whitespacesAndNewlines) }
    var trimmedPronunciation: String? {
        let p = pronunciation.trimmingCharacters(in: .whitespacesAndNewlines)
        return p.isEmpty ? nil : p
    }

    /// TTS'e verilecek ad (önizleme dinletmesi için).
    var spokenName: String { trimmedPronunciation ?? trimmedName }

    var canContinue: Bool {
        switch step {
        case .welcome, .parentInfo, .values, .avatar, .finale: true
        case .parentGate: hasPassedParentGate
        case .childInfo: Self.isValidName(childName) && Self.isValidPronunciation(pronunciation) && childAge != nil
        case .interests: !interests.isEmpty
        }
    }

    // MARK: Seçimler

    enum InterestToggleResult { case added, removed, limitReached }

    /// İlgi alanı seçimi; en fazla 5 (§3.1). Seçim sırası korunur (ilk seçilen masalda daha baskın).
    @discardableResult
    func toggle(_ interest: Interest) -> InterestToggleResult {
        if let i = interests.firstIndex(of: interest) {
            interests.remove(at: i)
            return .removed
        }
        guard interests.count < AppConfig.maxInterests else { return .limitReached }
        interests.append(interest)
        return .added
    }

    func toggle(_ value: ValueTopic) {
        if values.contains(value) { values.remove(value) } else { values.insert(value) }
    }

    // MARK: Gezinme

    func parentGateUnlocked() {
        hasPassedParentGate = true
        step = .parentInfo
    }

    func next() {
        guard canContinue else { return }
        switch step {
        case .welcome: step = hasPassedParentGate ? .parentInfo : .parentGate
        // Avatar adımından çıkış yalnızca `finish(in:)` ile (kayıt + kutlama).
        case .avatar, .finale: break
        default: step = Step(rawValue: step.rawValue + 1) ?? .finale
        }
        Analytics.shared.track(.onboardingStep(step.visibleIndex))
    }

    /// Değerler adımı isteğe bağlıdır.
    func skipValues() {
        guard step == .values else { return }
        values.removeAll()
        step = .avatar
    }

    func back() {
        switch step {
        case .welcome, .finale: break
        // Kapıya geri dönülmez: ebeveyn bilgisinden geri basınca karşılamaya gidilir.
        case .parentGate, .parentInfo: step = .welcome
        default: step = Step(rawValue: step.rawValue - 1) ?? .welcome
        }
    }

    // MARK: Kaydetme

    /// Kaydedilen aile; kutlama bitince `enterIsland()` onu "tamamlandı" yapar ve harita açılır.
    private(set) var createdFamily: Family?

    /// Aileyi ve ilk çocuk profilini kaydeder, kutlama adımına geçer.
    /// Aile kutlama bitene kadar "tamamlanmamış" kalır; uygulama bu arada kapanırsa onboarding baştan başlar
    /// ve yarım kalan kayıt burada silinir (çift aile oluşmaz).
    /// VARSAYIM: Onboarding tek çocukla biter; diğer çocuklar (childCount > 1) Ebeveyn Köşesi'nden eklenir (Adım 9).
    func finish(in context: ModelContext) {
        guard step == .avatar, Self.isValidName(childName) else { return }
        let stale = (try? context.fetch(FetchDescriptor<Family>(predicate: #Predicate { !$0.hasCompletedOnboarding }))) ?? []
        for f in stale { context.delete(f) }

        let family = Family(hasCompletedOnboarding: false, bedtime: bedtime)
        family.expectedChildCount = childCount
        family.settings = AppSettings()
        family.entitlement = Entitlement()
        let child = ChildProfile(name: trimmedName, age: childAge ?? 5, pronunciation: trimmedPronunciation,
                                 interests: interests, values: ValueTopic.allCases.filter { values.contains($0) },
                                 avatar: avatar, companion: companion)
        family.children.append(child)
        family.activeChildID = child.id
        context.insert(family)
        try? context.save()
        createdFamily = family
        step = .finale
        Analytics.shared.track(.onboardingStep(Self.visibleStepCount))
    }

    /// Kutlamadan sonra: aile tamamlandı, kök görünüm haritaya geçer.
    func enterIsland(in context: ModelContext) {
        guard let family = createdFamily else { return }
        family.hasCompletedOnboarding = true
        try? context.save()
    }
}
