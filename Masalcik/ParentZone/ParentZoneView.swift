import SwiftUI
import SwiftData

/// Ebeveyn Köşesi (§3.7): ebeveyn kapısının arkasında, en fazla 3 sekme.
/// Ebeveyn tarafı standart iOS düzeninde (Form/List), Dynamic Type ve VoiceOver tam desteklidir.
struct ParentZoneView: View {
    var onClose: () -> Void = {}

    @Query private var families: [Family]
    @State private var tab: Tab = .children

    enum Tab: Hashable { case children, settings, account }

    var body: some View {
        Group {
            if let family = families.first {
                TabView(selection: $tab) {
                    NavigationStack { ChildrenTab(family: family).toolbar { closeButton } }
                        .tabItem { Label("Çocuklar", systemImage: "figure.and.child.holdinghands") }
                        .tag(Tab.children)
                    NavigationStack { SettingsTab(family: family).toolbar { closeButton } }
                        .tabItem { Label("Ayarlar", systemImage: "gearshape.fill") }
                        .tag(Tab.settings)
                    NavigationStack { AccountTab(family: family, onErased: onClose).toolbar { closeButton } }
                        .tabItem { Label("Hesap", systemImage: "person.crop.circle") }
                        .tag(Tab.account)
                }
                .tint(Palette.grapeText)
            } else {
                ContentUnavailableView("Ebeveyn Köşesi", systemImage: "lock.fill")
            }
        }
        .fontDesign(.rounded)
    }

    @ToolbarContentBuilder private var closeButton: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button("Kapat", action: onClose)
        }
    }
}

// MARK: - Çocuklar

struct ChildrenTab: View {
    @Bindable var family: Family
    @State private var newChild: ChildProfile?

    var body: some View {
        List {
            if let active = family.activeChild {
                Section {
                    WeeklySummaryCard(child: active)
                } header: {
                    Text("Bu hafta — \(active.name)")
                }
            }
            Section {
                ForEach(family.orderedChildren) { child in
                    NavigationLink {
                        ChildEditView(child: child, family: family)
                    } label: {
                        ChildRow(child: child, isActive: family.activeChild?.id == child.id)
                    }
                    .swipeActions(edge: .leading) {
                        Button("Bu çocuk için kullan") { family.activeChildID = child.id }
                            .tint(Palette.grass)
                    }
                }
                if family.canAddChild {
                    Button {
                        newChild = ChildProfile(name: "", age: 5)
                    } label: {
                        Label("Profil ekle", systemImage: "plus.circle.fill")
                    }
                }
            } header: {
                Text("Profiller")
            } footer: {
                if family.children.count < family.expectedChildCount && family.canAddChild {
                    Text("Onboarding'de \(family.expectedChildCount) çocuk demiştiniz; diğer profilleri buradan ekleyebilirsiniz.")
                } else {
                    Text("En fazla \(AppConfig.maxChildProfiles) profil. Uygulamanın kimin için çalışacağını seçmek için profile girin.")
                }
            }
        }
        .navigationTitle(Text("Çocuklar"))
        .sheet(item: $newChild) { draft in
            NavigationStack {
                ChildEditView(child: draft, family: family, isNew: true) { newChild = nil }
            }
        }
    }
}

private struct ChildRow: View {
    let child: ChildProfile
    let isActive: Bool
    var body: some View {
        HStack(spacing: 12) {
            AvatarView(config: child.avatar, size: 52)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: child.name).font(.headline)
                Text("\(child.age) yaş · \(child.stories.count) masal").font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            if isActive {
                Label("Aktif", systemImage: "checkmark.circle.fill")
                    .labelStyle(.iconOnly)
                    .foregroundStyle(Palette.grass)
                    .accessibilityLabel(Text("Şu an bu çocuk için"))
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Haftalık özet: masal sayısı, gece sayısı, tahmini uykuya dalma saati.
struct WeeklySummaryCard: View {
    let child: ChildProfile
    var body: some View {
        let s = WeeklySummary.make(endTimes: child.storyEndTimes, now: .now)
        HStack(spacing: 0) {
            stat(value: "\(s.stories)", label: Text("masal"))
            Divider()
            stat(value: "\(s.nights)/7", label: Text("gece"))
            Divider()
            stat(value: s.formattedAverage() ?? "—", label: Text("tahmini uyku"))
        }
        .frame(minHeight: 64)
        .accessibilityElement(children: .combine)
    }

    private func stat(value: String, label: Text) -> some View {
        VStack(spacing: 2) {
            Text(verbatim: value).font(.title2.weight(.bold)).monospacedDigit()
            label.font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Profil düzenleme / ekleme.
struct ChildEditView: View {
    @Bindable var child: ChildProfile
    @Bindable var family: Family
    var isNew = false
    var onDone: () -> Void = {}

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var pronunciation = ""
    @State private var confirmDelete = false

    private var nameIsValid: Bool { OnboardingModel.isValidName(name) }
    private var pronunciationIsValid: Bool { OnboardingModel.isValidPronunciation(pronunciation) }

    var body: some View {
        Form {
            Section {
                TextField("Adı", text: $name)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                if !name.isEmpty && !nameIsValid {
                    Text("Ad yalnızca harflerden oluşabilir (en fazla 30).").font(.footnote).foregroundStyle(.red)
                }
                TextField("Nasıl okunur? Örn. Ay-şe", text: $pronunciation)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                Button {
                    let spoken = pronunciation.trimmingCharacters(in: .whitespaces).isEmpty ? name : pronunciation
                    VoicePrompter.shared.speak(String(localized: "İyi geceler, \(spoken)!"))
                } label: {
                    Label("Adı dinle", systemImage: "speaker.wave.2.fill")
                }
                .disabled(!nameIsValid)
                Picker("Yaş", selection: $child.age) {
                    ForEach(OnboardingModel.ageRange, id: \.self) { Text(verbatim: "\($0)").tag($0) }
                }
            } header: {
                Text("Çocuk")
            } footer: {
                Text("Adı sesli okurken bu yazımı kullanırız; ekranda her zaman asıl ad görünür.")
            }

            Section {
                ForEach(Interest.allCases) { interest in
                    Toggle(isOn: interestBinding(interest)) { Text(verbatim: "\(interest.emoji)  \(interest.title)") }
                        .disabled(!child.interests.contains(interest) && child.interests.count >= AppConfig.maxInterests)
                }
            } header: {
                Text("İlgi alanları")
            } footer: {
                Text("En fazla \(AppConfig.maxInterests) tane.")
            }

            Section {
                ForEach(ValueTopic.allCases) { topic in
                    Toggle(isOn: valueBinding(topic)) { Text(verbatim: "\(topic.emoji)  \(topic.title)") }
                }
            } header: {
                Text("Şu sıralar ne üzerine konuşalım?")
            } footer: {
                Text("Seçtiğiniz konular masallara nazikçe, korkutmadan işlenir. İstediğiniz zaman değiştirebilirsiniz.")
            }

            Section {
                NavigationLink {
                    ScrollView {
                        AvatarEditor(avatar: $child.avatar, companion: $child.companion).padding()
                    }
                    .background(Palette.cream.ignoresSafeArea())
                    .themed(.day)
                    .navigationTitle(Text("Avatar ve yol arkadaşı"))
                } label: {
                    HStack {
                        AvatarView(config: child.avatar, size: 44)
                        CharacterView(character: child.companion, size: 40, isInteractive: false)
                        Text("Avatar ve yol arkadaşı")
                    }
                }
                if !isNew {
                    NavigationLink { StoryHistoryView(child: child) } label: {
                        Label("Masal geçmişi", systemImage: "clock.arrow.circlepath")
                    }
                    if family.activeChild?.id != child.id {
                        Button("Bu çocuk için kullan") { family.activeChildID = child.id }
                    }
                }
            }

            if !isNew && family.children.count > 1 {
                Section {
                    Button("Profili sil", role: .destructive) { confirmDelete = true }
                } footer: {
                    Text("Bu çocuğun masalları, çıkartmaları ve ayarları bu cihazdan ve sunucudan silinir.")
                }
            }
        }
        .navigationTitle(isNew ? Text("Yeni profil") : Text(verbatim: child.name))
        .toolbar {
            if isNew {
                ToolbarItem(placement: .cancellationAction) { Button("Vazgeç", action: onDone) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Kaydet") {
                        commitName()
                        family.children.append(child)
                        onDone()
                    }
                    .disabled(!nameIsValid || !pronunciationIsValid)
                }
            }
        }
        .onAppear {
            name = child.name
            pronunciation = child.pronunciation ?? ""
        }
        .onDisappear { if !isNew { commitName() } }
        .confirmationDialog("Profili sil", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Sil", role: .destructive) {
                if family.activeChildID == child.id { family.activeChildID = nil }
                context.delete(child)
                dismiss()
            }
        } message: {
            Text("Bu işlem geri alınamaz.")
        }
    }

    /// Geçerli ad/telaffuz kaydedilir; geçersizse eski değer korunur.
    private func commitName() {
        if nameIsValid { child.name = name.trimmingCharacters(in: .whitespacesAndNewlines) }
        if pronunciationIsValid {
            let p = pronunciation.trimmingCharacters(in: .whitespacesAndNewlines)
            child.pronunciation = p.isEmpty ? nil : p
        }
    }

    private func interestBinding(_ i: Interest) -> Binding<Bool> {
        Binding(get: { child.interests.contains(i) }, set: { on in
            if on { if !child.interests.contains(i) && child.interests.count < AppConfig.maxInterests { child.interests.append(i) } }
            else { child.interests.removeAll { $0 == i } }
        })
    }

    private func valueBinding(_ v: ValueTopic) -> Binding<Bool> {
        Binding(get: { child.values.contains(v) }, set: { on in
            if on { if !child.values.contains(v) { child.values.append(v) } } else { child.values.removeAll { $0 == v } }
        })
    }
}

/// Masal geçmişi: metin olarak okunabilir, paylaşılabilir (§3.7).
struct StoryHistoryView: View {
    let child: ChildProfile

    var body: some View {
        let stories = child.stories.sorted { $0.createdAt > $1.createdAt }
        List {
            if stories.isEmpty {
                Text("Henüz masal yok.").foregroundStyle(.secondary)
            }
            ForEach(stories) { story in
                NavigationLink { StoryTextView(story: story) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(verbatim: story.title).font(.headline)
                        Text(story.createdAt, format: .dateTime.day().month().year().hour().minute())
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle(Text("Masal geçmişi"))
    }
}

/// Masalın tam metni + WhatsApp'ta paylaş.
struct StoryTextView: View {
    let story: Story
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(verbatim: story.title).font(.title2.bold())
                Text("\(story.region.title) · \(story.durationMinutes) dk").font(.subheadline).foregroundStyle(.secondary)
                ForEach(story.orderedParagraphs) { p in
                    Text(verbatim: p.text).font(.body)
                }
                if let moral = story.moral {
                    Text(verbatim: moral).font(.body.italic()).foregroundStyle(.secondary)
                }
            }
            .padding()
            .textSelection(.enabled)
        }
        .navigationTitle(Text(verbatim: story.title))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { ShareStoryButton(story: story) } }
    }
}
