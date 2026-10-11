import SwiftUI
import SwiftData

/// Hesap (§3.7): abonelik, satın alma/geri yükleme, gizlilik, veri silme, destek.
struct AccountTab: View {
    @Bindable var family: Family
    var onErased: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var context
    @State private var showsPaywall = false
    @State private var confirmErase = false
    @State private var erasing = false
    @State private var eraseFailed = false

    private var entitlement: Entitlement? { family.entitlement }

    var body: some View {
        Form {
            Section {
                LabeledContent("Plan") {
                    entitlement?.isPremium == true ? Text("Premium") : Text("Ücretsiz")
                }
                if let e = entitlement, e.isPremium, let expires = e.expiresAt {
                    LabeledContent {
                        Text(expires, format: .dateTime.day().month().year())
                    } label: {
                        e.isInTrial ? Text("Deneme bitişi") : Text("Yenileme")
                    }
                }
                if entitlement?.isPremium != true {
                    Button { showsPaywall = true } label: { Label("Premium'u incele", systemImage: "star.circle.fill") }
                }
                Button("Satın alımları geri yükle") { Task { await restore() } }
            } header: {
                Text("Abonelik")
            } footer: {
                Text("Ücretsiz sürümde her gün 1 kişisel masal ve kitaplıktan haftada 3 masal. Kredi ya da jeton yok.")
            }

            Section {
                Label("Masallar yapay zekâyla üretilir ve güvenlik filtrelerinden geçer.", systemImage: "sparkles")
                Label("Çocuğunuz için yalnızca adını, yaşını ve ilgi alanlarını saklarız. Reklam yok, üçüncü taraf takip yok.",
                      systemImage: "lock.shield.fill")
                Link(destination: AppConfig.privacyPolicyURL()) {
                    Label("Aydınlatma metnini okuyun", systemImage: "doc.text")
                }
            } header: {
                Text("Gizlilik")
            }

            Section {
                Button(role: .destructive) { confirmErase = true } label: {
                    if erasing { ProgressView() } else { Label("Tüm verilerimi sil", systemImage: "trash") }
                }
                .disabled(erasing)
            } footer: {
                Text("Hesabınız, çocuk profilleri, masallar, ses dosyaları ve ses örneğiniz sunucudan ve bu cihazdan kalıcı olarak silinir. Etkin bir aboneliği App Store'dan ayrıca iptal etmeniz gerekir.")
            }

            Section {
                Link(destination: URL(string: "mailto:destek@masalcik.app")!) {
                    Label("Destek: destek@masalcik.app", systemImage: "envelope")
                }
                LabeledContent("Sürüm") {
                    Text(verbatim: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—")
                }
            }
        }
        .navigationTitle(Text("Hesap"))
        .sheet(isPresented: $showsPaywall) { PaywallView() }
        .confirmationDialog("Tüm verilerimi sil", isPresented: $confirmErase, titleVisibility: .visible) {
            Button("Kalıcı olarak sil", role: .destructive) { Task { await erase() } }
            Button("Vazgeç", role: .cancel) {}
        } message: {
            Text("Bu işlem geri alınamaz.")
        }
        .alert("Silinemedi", isPresented: $eraseFailed) {
            Button("Tamam", role: .cancel) {}
        } message: {
            Text("Sunucudaki verileri silmek için internet bağlantısı gerekli. Bağlantınızı kontrol edip tekrar deneyin.")
        }
    }

    private func restore() async {
        guard let dto = try? await appState.api.verifyEntitlement(signedTransaction: nil) else { return }
        EntitlementSync.apply(dto, to: family)
    }

    private func erase() async {
        erasing = true
        defer { erasing = false }
        do {
            try await DataEraser.eraseEverything(api: appState.api, auth: appState.auth, context: context)
            onErased()
        } catch {
            eraseFailed = true
        }
    }
}

/// Sunucudaki abonelik durumunu yerel önbelleğe yazar (Adım 10'da StoreKit 2 ile genişler).
enum EntitlementSync {
    @MainActor static func apply(_ dto: EntitlementDTO, to family: Family) {
        let e = family.entitlement ?? Entitlement()
        e.tier = dto.tier
        e.productID = dto.productId
        e.expiresAt = dto.expiresAt
        e.isInTrial = dto.isInTrial
        e.lastVerifiedAt = .now
        family.entitlement = e
    }
}

/// Tek dokunuşla veri silme (§6, KVKK/COPPA): önce sunucu, sonra cihaz.
/// Sunucu silinemezse (ağ yok) cihazdaki veriler de silinmez: yarım silme olmasın; ebeveyne söylenir.
enum DataEraser {
    @MainActor
    static func eraseEverything(api: StoryAPI, auth: AuthSession?, context: ModelContext,
                                fileManager: FileManager = .default) async throws {
        try await api.deleteAccount()
        try eraseLocal(context: context, fileManager: fileManager)
        await auth?.signOut()
    }

    /// Cihazdaki tüm kayıtlar + indirilmiş ses dosyaları + ayar önbellekleri.
    @MainActor
    static func eraseLocal(context: ModelContext, fileManager: FileManager = .default) throws {
        try context.delete(model: Family.self)
        try context.delete(model: ChildProfile.self)
        try context.delete(model: Story.self)
        try context.delete(model: StoryParagraph.self)
        try context.delete(model: RecurringCharacter.self)
        try context.delete(model: Sticker.self)
        try context.delete(model: AppSettings.self)
        try context.delete(model: Entitlement.self)
        try context.save()
        let audio = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appending(path: "Audio")
        try? fileManager.removeItem(at: audio)
        Analytics.shared.clear()
    }
}

/// "Bu masalı WhatsApp'ta paylaş" (§3.7): ebeveyn kapısının arkasında. Bağlantı web önizleme sayfasını açar
/// (masalı dinleme + uygulamayı indirme). Paylaşmadan önce masalda çocuğun adı geçtiği hatırlatılır.
struct ShareStoryButton: View {
    let story: Story
    @Environment(AppState.self) private var appState
    @State private var url: URL?
    @State private var loading = false
    @State private var failed = false

    var body: some View {
        Group {
            if let url {
                ShareLink(item: url, subject: Text(verbatim: story.title),
                          message: Text("\(story.title) — \(AppConfig.appName) ile çocuğuma özel bir uyku masalı. Sen de dinle:")) {
                    Label("Paylaş", systemImage: "square.and.arrow.up")
                }
            } else {
                Button {
                    Task { await prepare() }
                } label: {
                    if loading { ProgressView() } else { Label("Paylaş", systemImage: "square.and.arrow.up") }
                }
                .disabled(loading)
            }
        }
        .alert("Paylaşım bağlantısı oluşturulamadı", isPresented: $failed) { Button("Tamam", role: .cancel) {} }
    }

    private func prepare() async {
        loading = true
        defer { loading = false }
        do { url = try await appState.api.shareStory(id: story.id) } catch { failed = true }
    }
}
