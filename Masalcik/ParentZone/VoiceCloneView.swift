import SwiftUI
import AVFoundation

/// Ebeveynin kendi sesi (§4.5, Premium): ayrı ve açık rıza → ~1 dk metin okuma → yükleme.
/// Ses örneği yalnızca bu ailenin masallarında kullanılır ve istendiği an silinir (KVKK: ayrı açık rıza).
struct VoiceCloneView: View {
    @Bindable var family: Family
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var consent = false
    @State private var recorder = VoiceSampleRecorder()
    @State private var status: Status = .idle

    enum Status: Equatable { case idle, uploading, done, failed }

    private var isPremium: Bool { family.entitlement?.isPremium ?? false }
    private var settings: AppSettings? { family.settings }

    var body: some View {
        Form {
            if settings?.hasVoiceClone == true {
                Section {
                    Label("Sesiniz kayıtlı ve yalnızca sizin ailenizin masallarında kullanılıyor.", systemImage: "checkmark.seal.fill")
                    Button("Ses örneğimi ve klon sesimi sil", role: .destructive) {
                        Task { await deleteClone() }
                    }
                }
            } else if !isPremium {
                Section {
                    Text("Kendi sesinizle anlatım Premium özelliğidir.")
                }
            } else {
                Section {
                    Text("Bir dakikalık kısa bir metni okuyarak kendi anlatıcı sesinizi oluşturabilirsiniz. Ses örneğiniz yalnızca sizin ailenizin masallarında kullanılır, kimseyle paylaşılmaz ve buradan istediğiniz an silinebilir.")
                    Toggle(isOn: $consent) {
                        Text("Ses örneğimin bu amaçla işlenmesine açıkça rıza veriyorum.")
                    }
                } header: {
                    Text("Açık rıza")
                } footer: {
                    Link("Aydınlatma metnini okuyun", destination: AppConfig.privacyPolicyURL())
                }

                if consent {
                    Section {
                        Text(VoiceSampleRecorder.script).font(.body)
                    } header: {
                        Text("Bu metni sakin bir sesle okuyun")
                    }
                    Section {
                        if recorder.isRecording {
                            ProgressView(value: recorder.elapsed, total: VoiceSampleRecorder.maxDuration)
                            Button("Kaydı bitir") { recorder.stop() }
                        } else if recorder.sampleURL == nil {
                            Button { Task { await recorder.start() } } label: { Label("Kaydı başlat", systemImage: "mic.fill") }
                            if recorder.permissionDenied {
                                Text("Mikrofon izni gerekli: iPhone Ayarları › Masalcık › Mikrofon.").font(.footnote).foregroundStyle(.red)
                            }
                        } else {
                            Button { Task { await upload() } } label: { Label("Sesimi oluştur", systemImage: "arrow.up.circle.fill") }
                                .disabled(status == .uploading || recorder.elapsed < VoiceSampleRecorder.minDuration)
                            Button("Yeniden kaydet") { recorder.discard() }
                            if recorder.elapsed < VoiceSampleRecorder.minDuration {
                                Text("Kayıt en az 30 saniye olmalı.").font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                        switch status {
                        case .uploading: ProgressView()
                        case .done: Label("Sesiniz hazırlanıyor. Birkaç dakika içinde anlatıcı olarak seçebilirsiniz.", systemImage: "checkmark.circle.fill")
                        case .failed: Text("Yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.").foregroundStyle(.red)
                        case .idle: EmptyView()
                        }
                    }
                }
            }
        }
        .navigationTitle(Text("Kendi sesim"))
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Bitti") { dismiss() } } }
        .onDisappear { recorder.discardIfUnsent(status == .done) }
    }

    private func upload() async {
        guard let url = recorder.sampleURL, let data = try? Data(contentsOf: url) else { return }
        status = .uploading
        do {
            _ = try await appState.api.createVoiceClone(sample: data, consentedAt: .now)
            settings?.voiceCloneConsentAt = .now
            settings?.hasVoiceClone = true
            status = .done
            recorder.discard()     // örnek cihazda tutulmaz
        } catch {
            status = .failed
        }
    }

    private func deleteClone() async {
        try? await appState.api.deleteVoiceClone()
        settings?.hasVoiceClone = false
        settings?.voiceCloneConsentAt = nil
        if settings?.voice == .parentClone { settings?.voice = .mother }
    }
}

/// ~1 dakikalık ses örneği kaydı (m4a, geçici dosya).
@MainActor
@Observable
final class VoiceSampleRecorder: NSObject {
    static let maxDuration: TimeInterval = 75
    static let minDuration: TimeInterval = 30
    static var script: String {
        String(localized: "Bir varmış bir yokmuş. Uzak bir ormanın kıyısında, küçük bir evde meraklı bir çocuk yaşarmış. Her akşam pencereden yıldızları sayar, ay ışığında masallar dinlermiş. Bir gece gökyüzünden minik bir yıldız süzülmüş ve pencerenin önüne konmuş. Yıldız fısıldamış: Benimle hayal ülkesine gelir misin? Çocuk gülümsemiş, battaniyesine sarılmış ve gözlerini yavaşça kapatmış. Rüyasında bulutların üstünde yürümüş, rüzgârla şarkı söylemiş, denizin dalgalarıyla oyun oynamış. Sabah olunca güneş yüzünü okşamış. Gökten üç elma düşmüş: biri sana, biri bana, biri de bu masalı dinleyen herkese.")
    }

    private(set) var isRecording = false
    private(set) var elapsed: TimeInterval = 0
    private(set) var sampleURL: URL?
    private(set) var permissionDenied = false
    @ObservationIgnored private var recorder: AVAudioRecorder?
    @ObservationIgnored private var ticker: Task<Void, Never>?

    func start() async {
        guard await AVAudioApplication.requestRecordPermission() else { permissionDenied = true; return }
        let url = FileManager.default.temporaryDirectory.appending(path: "voice-sample-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 44_100, AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
        try? AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        guard let r = try? AVAudioRecorder(url: url, settings: settings), r.record(forDuration: Self.maxDuration) else { return }
        recorder = r
        sampleURL = nil
        elapsed = 0
        isRecording = true
        ticker = Task { [weak self] in
            while let self, self.isRecording, !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                self.elapsed = self.recorder?.currentTime ?? self.elapsed
                if self.recorder?.isRecording == false { self.finish(url) }
            }
        }
    }

    func stop() {
        guard let url = recorder?.url else { return }
        elapsed = recorder?.currentTime ?? elapsed
        recorder?.stop()
        finish(url)
    }

    private func finish(_ url: URL) {
        isRecording = false
        ticker?.cancel()
        sampleURL = url
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    func discard() {
        if let sampleURL { try? FileManager.default.removeItem(at: sampleURL) }
        sampleURL = nil
        elapsed = 0
    }

    /// Ekran kapanırken gönderilmemiş örnek cihazda bırakılmaz.
    func discardIfUnsent(_ sent: Bool) {
        if isRecording { recorder?.stop(); isRecording = false }
        if !sent { discard() }
    }
}
