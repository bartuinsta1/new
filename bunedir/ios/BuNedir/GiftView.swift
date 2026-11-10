import SwiftUI

/// Kaydol → diğer uygulamamızda 2 ay ücretsiz deneme kodu. Bu uygulamanın hiçbir özelliği kayda bağlı
/// değildir (App Store 5.1.1): kayıt yalnızca hediye kodu için.
struct GiftView: View {
    @EnvironmentObject private var account: Account
    @State private var email = ""
    @State private var otp = ""
    @State private var codeSent = false
    @State private var error: String?
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    PaperCard(tilt: -1.2, padding: 18) {
                        VStack(spacing: 8) {
                            Image(systemName: "gift.fill").font(.largeTitle).foregroundStyle(Theme.accent)
                            Text("2 ay ücretsiz").font(Theme.word(30)).foregroundStyle(Theme.accent)
                            Text("Ücretsiz kaydol, yakında çıkacak yeni uygulamamızı \(AppConfig.trialDays / 30) ay boyunca ücretsiz dene.")
                                .font(Theme.body(15)).multilineTextAlignment(.center).foregroundStyle(Theme.ink)
                        }
                        .frame(maxWidth: .infinity)
                    }

                    if let trial = account.trial {
                        codeCard(trial)
                    } else if !AppConfig.accountEnabled {
                        Text("Kayıt çok yakında açılıyor.").font(Theme.body(15)).foregroundStyle(.secondary)
                    } else if !codeSent {
                        emailStep
                    } else {
                        otpStep
                    }

                    if let error {
                        Text(error).font(.callout).foregroundStyle(Theme.review).multilineTextAlignment(.center)
                    }
                }
                .padding(20)
            }
            .navigationTitle("Hediye")
            .disabled(account.busy)
            .overlay { if account.busy { ProgressView() } }
            .confirmationDialog("Hesabın ve hediye kodun kalıcı olarak silinsin mi?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Hesabımı sil", role: .destructive) { run { try await account.deleteAccount(); codeSent = false; otp = "" } }
            }
        }
    }

    private var emailStep: some View {
        VStack(spacing: 12) {
            TextField("E-posta adresin", text: $email)
                .textContentType(.emailAddress).keyboardType(.emailAddress)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .padding(12).background(Theme.paper).clipShape(RoundedRectangle(cornerRadius: 8))
            Button("Kodu gönder") { run { try await account.sendCode(to: email); codeSent = true } }
                .buttonStyle(.borderedProminent).controlSize(.large)
            Text("Parola yok. E-postana 6 haneli bir kod göndereceğiz. Adresini yalnızca hediyeni tanımlamak için kullanırız; reklam göndermeyiz.")
                .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
    }

    private var otpStep: some View {
        VStack(spacing: 12) {
            Text("\(account.email ?? email) adresine gelen kodu yaz").font(Theme.body(14))
            TextField("6 haneli kod", text: $otp)
                .textContentType(.oneTimeCode).keyboardType(.numberPad)
                .multilineTextAlignment(.center).font(.title2.monospacedDigit())
                .padding(12).background(Theme.paper).clipShape(RoundedRectangle(cornerRadius: 8))
            Button("Onayla") { run { try await account.verify(code: otp) } }
                .buttonStyle(.borderedProminent).controlSize(.large).disabled(otp.filter(\.isNumber).count < 6)
            Button("E-postayı değiştir") { codeSent = false; otp = "" }.font(.footnote)
        }
    }

    private func codeCard(_ trial: TrialCode) -> some View {
        VStack(spacing: 14) {
            Text("Hediye kodun").font(Theme.body(13, weight: .bold)).foregroundStyle(.secondary)
            Text(trial.code).font(.system(size: 28, weight: .bold, design: .monospaced)).foregroundStyle(Theme.ink)
                .textSelection(.enabled)
            Text(trial.redeemed
                 ? "Bu kod kullanıldı. İyi eğlenceler!"
                 : "Yeni uygulamamız çıkınca bu kodu orada gir, \(trial.trialDays) gün ücretsiz kullan. Kod e-posta adresine bağlı, kaybolmaz.")
                .font(Theme.body(14)).multilineTextAlignment(.center)
            HStack {
                Button { UIPasteboard.general.string = trial.code } label: { Label("Kopyala", systemImage: "doc.on.doc") }
                ShareLink(item: "Bu Nedir? hediye kodum: \(trial.code)") { Label("Paylaş", systemImage: "square.and.arrow.up") }
            }
            .buttonStyle(.bordered)
            Button("Hesabımı sil", role: .destructive) { confirmDelete = true }.font(.footnote).padding(.top, 12)
        }
        .task { try? await account.refreshTrial() }
    }

    private func run(_ op: @escaping () async throws -> Void) {
        error = nil
        account.busy = true
        Task {
            defer { account.busy = false }
            do { try await op() } catch { self.error = error.localizedDescription }
        }
    }
}
