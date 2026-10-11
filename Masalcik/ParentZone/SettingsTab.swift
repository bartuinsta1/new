import SwiftUI
import SwiftData

/// Ayarlar (§3.7): uyku saati, ses, altyazı, ortam sesi, içerik filtreleri, masal süresi, ses klonlama, dil.
struct SettingsTab: View {
    @Bindable var family: Family

    var body: some View {
        if let settings = family.settings {
            SettingsForm(family: family, settings: settings)
        } else {
            // Eski kayıtlarda ayar nesnesi yoksa bir kez oluştur (görünüm güncellemesi dışında).
            ProgressView().task { family.settings = AppSettings() }
        }
    }
}

private struct SettingsForm: View {
    @Bindable var family: Family
    @Bindable var settings: AppSettings
    @Environment(AppState.self) private var appState
    @State private var confirmLoss = false
    @State private var showsVoiceClone = false

    var body: some View {
        Form {
            Section {
                DatePicker("Uyku saati", selection: bedtimeBinding, displayedComponents: .hourAndMinute)
            } footer: {
                Text("Uyku saatinden bir saat önce uygulama sakin gece moduna geçer.")
            }

            Section("Ses") {
                Picker("Anlatıcı", selection: $settings.voice) {
                    ForEach(VoiceTone.allCases.filter { $0 != .parentClone || settings.hasVoiceClone }) { tone in
                        Text(verbatim: tone.title).tag(tone)
                    }
                }
                Button {
                    VoicePrompter.shared.speak(String(localized: "Bir varmış bir yokmuş"))
                } label: {
                    Label("Örnek dinle", systemImage: "play.circle")
                }
                Button {
                    showsVoiceClone = true
                } label: {
                    Label {
                        settings.hasVoiceClone ? Text("Kendi sesim (kayıtlı)") : Text("Kendi sesimle anlat")
                    } icon: { Image(systemName: "waveform.badge.mic") }
                }
            }

            Section("Masal") {
                Picker("Masal süresi", selection: $settings.defaultDuration) {
                    ForEach(StoryDuration.allCases, id: \.self) { d in Text("\(d.rawValue) dk").tag(d) }
                }
                Toggle("Altyazı (kelime kelime)", isOn: $settings.subtitlesEnabled)
                Toggle("Masal sırasında ninni fonu", isOn: $settings.backgroundLullabyEnabled)
                Picker("Masaldan sonra", selection: $settings.lullabyMinutesAfterStory) {
                    Text("Kapalı").tag(0)
                    ForEach([10, 15, 20, 30], id: \.self) { m in Text("\(m) dk").tag(m) }
                }
                if settings.lullabyMinutesAfterStory > 0 {
                    Picker("Masaldan sonraki ses", selection: $settings.afterStorySound) {
                        Text("Ninni").tag(AfterStorySound.lullaby)
                        Text("Beyaz gürültü").tag(AfterStorySound.whiteNoise)
                    }
                }
            }

            Section {
                Toggle("Ortam sesleri (kuş, cırcır böceği)", isOn: $settings.ambientSoundEnabled)
                    .onChange(of: settings.ambientSoundEnabled) { _, on in AmbientSoundPlayer.shared.isEnabled = on }
                Toggle("Dokunma titreşimi ve sesi", isOn: $settings.hapticsEnabled)
                    .onChange(of: settings.hapticsEnabled) { _, on in
                        Feedback.hapticsEnabled = on
                        Feedback.soundsEnabled = on
                    }
            } header: {
                Text("Uygulama")
            }

            Section {
                Toggle("Hafif heyecan", isOn: $settings.contentFilters.allowMildScary)
                Toggle("Küçük anlaşmazlıklar", isOn: $settings.contentFilters.allowConflict)
                Toggle("Kayıp ve ayrılık temaları", isOn: lossBinding)
            } header: {
                Text("İçerik filtreleri")
            } footer: {
                Text("Hepsi varsayılan olarak kapalıdır. Şiddet, korku imgeleri, marka ve gerçek kişiler her zaman yasaktır; her masal yayından önce güvenlik denetiminden geçer.")
            }

            Section {
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                } label: {
                    LabeledContent("Dil") { Text(verbatim: AppLanguage.current.nativeName) }
                }
            } footer: {
                Text("Dil, iPhone Ayarları'ndan değiştirilir; masallar da seçilen dilde anlatılır.")
            }
        }
        .navigationTitle(Text("Ayarlar"))
        .confirmationDialog("Kayıp ve ayrılık temaları", isPresented: $confirmLoss, titleVisibility: .visible) {
            Button("Aç") { settings.contentFilters.allowLossAndSeparation = true }
            Button("Vazgeç", role: .cancel) {}
        } message: {
            Text("Örneğin bir evcil hayvanın ya da büyükannenin kaybını konuşmak isterseniz açın. Masallar bu konuyu çok nazik ve umutlu biçimde işler.")
        }
        .sheet(isPresented: $showsVoiceClone) {
            NavigationStack { VoiceCloneView(family: family) }
        }
    }

    /// Kayıp teması bilinçli bir seçim olsun: açmak onay ister, kapatmak istemez.
    private var lossBinding: Binding<Bool> {
        Binding(get: { settings.contentFilters.allowLossAndSeparation }, set: { on in
            if on { confirmLoss = true } else { settings.contentFilters.allowLossAndSeparation = false }
        })
    }

    private var bedtimeBinding: Binding<Date> {
        Binding {
            Calendar.current.date(from: DateComponents(hour: family.bedtime.hour, minute: family.bedtime.minute)) ?? .now
        } set: { date in
            let c = Calendar.current.dateComponents([.hour, .minute], from: date)
            family.bedtime = Bedtime(hour: c.hour ?? 20, minute: c.minute ?? 0)
            appState.bedtime = family.bedtime
        }
    }
}
