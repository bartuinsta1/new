import SwiftUI

// MARK: 1 — Karşılama

struct WelcomeStepView: View {
    let model: OnboardingModel
    @Environment(\.theme) private var theme
    @State private var awake = false

    var body: some View {
        OnboardingScaffold(step: .welcome, primaryTitle: "Başlayalım", showsBack: false, onPrimary: model.next) {
            VStack(spacing: Metrics.spacingL) {
                // Pamuk önce esner, sonra el sallar gibi zıplar.
                CharacterView(character: .pamuk, mood: awake ? .happy : .sleepy, size: 220)
                    .padding(.top, Metrics.spacingXL)
                Text(verbatim: AppConfig.appName).masalFont(.display).foregroundStyle(theme.ink)
                VoicePromptPlayer(text: String(localized: "Merhaba! Ben Pamuk. Her gece sana özel bir masal anlatacağım."),
                                  recordingKey: "vp_welcome", speaker: .pamuk, autoplay: true, showsText: true)
                AINotice()
            }
        }
        .task {
            try? await Task.sleep(for: .seconds(1.4))
            awake = true
        }
    }
}

/// §6: "Masallar yapay zekâyla üretilir ve güvenlik filtrelerinden geçer" — uygulama içinde açıkça.
struct AINotice: View {
    @Environment(\.theme) private var theme
    var body: some View {
        Label {
            Text("Masallar yapay zekâyla üretilir ve güvenlik filtrelerinden geçer.")
        } icon: {
            Image(systemName: "sparkles")
        }
        .masalFont(.caption)
        .foregroundStyle(theme.secondaryInk)
        .multilineTextAlignment(.center)
    }
}

// MARK: 2a — Ebeveyn kapısı

struct ParentGateStepView: View {
    let model: OnboardingModel
    @Environment(\.theme) private var theme

    var body: some View {
        VStack {
            HStack {
                BubbleButton(systemImage: "chevron.left", color: .sky, accessibilityLabel: "Geri", action: model.back)
                Spacer()
                StepDots(current: 2, total: OnboardingModel.visibleStepCount)
                Spacer()
                Color.clear.frame(width: Metrics.minTapTarget, height: Metrics.minTapTarget)
            }
            .padding(.horizontal, Metrics.spacingM)
            .padding(.top, Metrics.spacingS)
            Text("Şimdi biraz anne ya da babanın yardımı lazım!")
                .masalFont(.headline).multilineTextAlignment(.center).foregroundStyle(theme.ink)
                .padding(.horizontal)
            ParentGate(onUnlock: model.parentGateUnlocked, onCancel: model.back, showsClose: false)
            Spacer(minLength: 0)
        }
        .background(theme.background.ignoresSafeArea())
    }
}

// MARK: 2b — Ebeveyn bilgisi

struct ParentInfoStepView: View {
    @Bindable var model: OnboardingModel
    @Environment(\.theme) private var theme

    private var bedtimeDate: Binding<Date> {
        Binding {
            Calendar.current.date(from: DateComponents(hour: model.bedtime.hour, minute: model.bedtime.minute)) ?? .now
        } set: { date in
            let c = Calendar.current.dateComponents([.hour, .minute], from: date)
            model.bedtime = Bedtime(hour: c.hour ?? 20, minute: c.minute ?? 0)
        }
    }

    var body: some View {
        OnboardingScaffold(step: .parentInfo, onPrimary: model.next, onBack: model.back) {
            VStack(spacing: Metrics.spacingL) {
                OnboardingHeader(title: "Biraz da sizi tanıyalım",
                                 subtitle: "Bu bilgilerle masal saatini çocuğunuzun rutinine uyduruyoruz.")
                card {
                    Text("Kaç çocuğunuz var?").masalFont(.headline).foregroundStyle(theme.ink)
                    HStack(spacing: Metrics.spacingM) {
                        ForEach(1...AppConfig.maxChildProfiles, id: \.self) { n in
                            ChoiceBubble(emoji: nil, title: "\(n)", isSelected: model.childCount == n,
                                         color: .grape, size: 64) { model.childCount = n }
                        }
                    }
                    if model.childCount > 1 {
                        Text("Önce bir çocukla başlayalım; diğerlerini Ebeveyn Köşesi'nden ekleyebilirsiniz.")
                            .masalFont(.caption).foregroundStyle(theme.secondaryInk).multilineTextAlignment(.center)
                    }
                }
                card {
                    Text("Uyku saati").masalFont(.headline).foregroundStyle(theme.ink)
                    DatePicker("Uyku saati", selection: bedtimeDate, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.wheel)
                        .labelsHidden()
                        .frame(maxHeight: 140)
                        .clipped()
                    Text("Uyku saatinden bir saat önce uygulama sakin gece moduna geçer.")
                        .masalFont(.caption).foregroundStyle(theme.secondaryInk).multilineTextAlignment(.center)
                }
                PrivacyNote()
            }
        }
    }

    private func card<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        VStack(spacing: Metrics.spacingM) { content() }
            .padding(Metrics.spacingM)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous).fill(theme.surface))
            .overlay(RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous)
                .strokeBorder(theme.outline, lineWidth: Metrics.outlineWidth))
    }
}

/// KVKK/COPPA: veri minimizasyonu ve aydınlatma metni (ebeveyn kapısının arkasında).
struct PrivacyNote: View {
    @Environment(\.theme) private var theme
    var body: some View {
        VStack(spacing: 6) {
            Label {
                Text("Çocuğunuz için yalnızca adını, yaşını ve ilgi alanlarını saklarız. Reklam yok, üçüncü taraf takip yok.")
            } icon: { Image(systemName: "lock.shield.fill") }
                .masalFont(.caption)
            Link(destination: AppConfig.privacyPolicyURL()) {
                Text("Aydınlatma metnini okuyun").masalFont(.caption).underline()
            }
        }
        .foregroundStyle(theme.secondaryInk)
        .multilineTextAlignment(.center)
    }
}

// MARK: 3 — Çocuğun adı ve yaşı

struct ChildInfoStepView: View {
    @Bindable var model: OnboardingModel
    @Environment(\.theme) private var theme
    @FocusState private var focus: Field?
    private enum Field { case name, pronunciation }

    var body: some View {
        OnboardingScaffold(step: .childInfo, canContinue: model.canContinue, onPrimary: model.next, onBack: model.back) {
            VStack(spacing: Metrics.spacingL) {
                OnboardingHeader(title: "Masalın kahramanı kim?",
                                 subtitle: "Çocuğunuzun adı masalda 3–5 kez geçecek.")
                VStack(alignment: .leading, spacing: Metrics.spacingS) {
                    Text("Adı").masalFont(.bodyBold).foregroundStyle(theme.ink)
                    HStack(spacing: Metrics.spacingS) {
                        TextField("Örn. Ayşe", text: $model.childName)
                            .focused($focus, equals: .name)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .submitLabel(.next)
                            .onSubmit { focus = .pronunciation }
                            .masalFont(.headline)
                            .padding(.horizontal, Metrics.spacingM)
                            .frame(minHeight: 56)
                            .background(fieldBackground)
                        // Ad sesli okunur: ebeveyn telaffuzu kontrol eder (§3.1 adım 3).
                        BubbleButton(systemImage: "speaker.wave.2.fill", color: .sky, accessibilityLabel: "Adı dinle") {
                            guard OnboardingModel.isValidName(model.childName) else { return }
                            VoicePrompter.shared.speak(String(localized: "İyi geceler, \(model.spokenName)!"))
                        }
                        .disabled(!OnboardingModel.isValidName(model.childName))
                    }
                    if !model.childName.isEmpty && !OnboardingModel.isValidName(model.childName) {
                        Text("Ad yalnızca harflerden oluşabilir (en fazla 30).")
                            .masalFont(.caption).foregroundStyle(Palette.berry)
                    }
                }
                VStack(alignment: .leading, spacing: Metrics.spacingS) {
                    Text("Doğru okunmuyor mu? (isteğe bağlı)").masalFont(.bodyBold).foregroundStyle(theme.ink)
                    TextField("Nasıl okunur? Örn. Ay-şe", text: $model.pronunciation)
                        .focused($focus, equals: .pronunciation)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .submitLabel(.done)
                        .masalFont(.body)
                        .padding(.horizontal, Metrics.spacingM)
                        .frame(minHeight: 52)
                        .background(fieldBackground)
                    Text("Adı sesli okurken bu yazımı kullanırız; ekranda her zaman asıl ad görünür.")
                        .masalFont(.caption).foregroundStyle(theme.secondaryInk)
                }
                VStack(spacing: Metrics.spacingS) {
                    Text("Kaç yaşında?").masalFont(.bodyBold).foregroundStyle(theme.ink)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4), spacing: 14) {
                        ForEach(OnboardingModel.ageRange, id: \.self) { age in
                            ChoiceBubble(emoji: nil, title: "\(age)", isSelected: model.childAge == age,
                                         color: .orange, size: 68) { model.childAge = age }
                        }
                    }
                }
            }
        }
    }

    private var fieldBackground: some View {
        RoundedRectangle(cornerRadius: 18, style: .continuous).fill(theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(theme.outline, lineWidth: Metrics.outlineWidth))
    }
}

// MARK: 4 — İlgi alanları (çocuk + ebeveyn birlikte)

struct InterestsStepView: View {
    let model: OnboardingModel
    @Environment(\.theme) private var theme
    @State private var shake = 0
    private static let colors: [AccentColor] = [.sun, .grass, .berry, .grape, .orange, .sky]

    var body: some View {
        OnboardingScaffold(step: .interests, canContinue: model.canContinue, onPrimary: model.next, onBack: model.back) {
            VStack(spacing: Metrics.spacingL) {
                VoicePromptPlayer(text: String(localized: "En sevdiğin şeyleri seç! En fazla beş tane."),
                                  recordingKey: "vp_interests", speaker: .findik, autoplay: true, showsText: true)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 108), spacing: 12)], spacing: 16) {
                    ForEach(Array(Interest.allCases.enumerated()), id: \.element) { i, interest in
                        ChoiceBubble(emoji: interest.emoji, title: interest.title,
                                     isSelected: model.interests.contains(interest),
                                     color: Self.colors[i % Self.colors.count]) {
                            switch model.toggle(interest) {
                            case .added: VoicePrompter.shared.speak(interest.title)
                            case .removed: break
                            case .limitReached:
                                shake += 1
                                Feedback.error()
                                VoicePrompter.shared.speak(String(localized: "En fazla beş tane seçebilirsin!"))
                            }
                        }
                    }
                }
                ProgressStars(filled: model.interests.count, total: AppConfig.maxInterests, starSize: 28)
                    .modifier(ShakeEffect(animatableData: CGFloat(shake)))
                    .animation(.default, value: shake)
            }
        }
    }
}

// MARK: 5 — Değerler ve gündem (isteğe bağlı, ebeveyn)

struct ValuesStepView: View {
    let model: OnboardingModel

    var body: some View {
        OnboardingScaffold(step: .values, secondaryTitle: "Şimdilik geç",
                           onPrimary: model.next, onBack: model.back, onSecondary: model.skipValues) {
            VStack(spacing: Metrics.spacingL) {
                OnboardingHeader(title: "Şu sıralar ne üzerine konuşalım?",
                                 subtitle: "Seçtiğiniz konular masallara nazikçe, korkutmadan işlenir. İstediğiniz zaman değiştirebilirsiniz.")
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 108), spacing: 12)], spacing: 16) {
                    ForEach(ValueTopic.allCases) { topic in
                        ChoiceBubble(emoji: topic.emoji, title: topic.title, isSelected: model.values.contains(topic),
                                     color: .berry) { model.toggle(topic) }
                    }
                }
            }
        }
    }
}
