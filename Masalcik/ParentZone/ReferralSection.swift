import SwiftUI

/// "Arkadaşını davet et" (§9): davet eden ve edilen 1 hafta Premium kazanır. Hesap sekmesinde, ebeveyn kapısının
/// arkasında. Kod elle girilir; üçüncü taraf bağlantı/izleme SDK'sı yok.
struct ReferralSection: View {
    @Bindable var family: Family
    @Environment(AppState.self) private var appState
    @State private var referral: ReferralDTO?
    @State private var input = ""
    @State private var redeeming = false
    @State private var result: Result?

    enum Result: Identifiable, Equatable {
        /// Premium bitiş tarihi, biçimlenmiş.
        case success(String)
        case rejected(String)
        case failed
        var id: String { "\(self)" }
    }

    var body: some View {
        Section {
            if let referral {
                LabeledContent("Davet kodunuz") {
                    Text(verbatim: referral.code).font(.body.monospaced().bold()).textSelection(.enabled)
                }
                ShareLink(item: Self.inviteMessage(code: referral.code)) {
                    Label("Davet kodunu paylaş", systemImage: "square.and.arrow.up")
                }
                if referral.rewardsThisYear > 0 {
                    LabeledContent("Bu yıl kazanılan") { Text("\(referral.rewardsThisYear) hafta") }
                }
            }
            HStack {
                TextField("Arkadaşınızın kodu", text: $input)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .font(.body.monospaced())
                    .accessibilityIdentifier("referral.input")
                Button {
                    Task { await redeem() }
                } label: {
                    if redeeming { ProgressView() } else { Text("Kullan") }
                }
                .disabled(redeeming || Self.normalized(input) == nil)
            }
        } header: {
            Text("Arkadaşını davet et")
        } footer: {
            Text("Arkadaşınız uygulamayı indirip kodunuzu girerse ikiniz de 1 hafta Premium kazanırsınız. Her hesap bir kez kod kullanabilir.")
        }
        .task { referral = try? await appState.api.referral() }
        .alert(item: $result) { result in
            switch result {
            case .success(let until):
                Alert(title: Text("1 hafta Premium açıldı"),
                      message: Text("Premium bitişi: \(until). Arkadaşınız da 1 hafta kazandı."))
            case .rejected("own_code"):
                Alert(title: Text("Bu sizin kodunuz"), message: Text("Bir arkadaşınızın kodunu girin."))
            case .rejected("already_redeemed"):
                Alert(title: Text("Davet kodu zaten kullanıldı"), message: Text("Her hesap yalnızca bir kez davet kodu kullanabilir."))
            case .rejected:
                Alert(title: Text("Kod bulunamadı"), message: Text("Kodu kontrol edip tekrar deneyin."))
            case .failed:
                Alert(title: Text("Kod şu an kullanılamadı"), message: Text("İnternet bağlantınızı kontrol edip tekrar deneyin."))
            }
        }
    }

    /// Paylaşım metni: masal bağlantısı olmadan da gönderilebilir.
    static func inviteMessage(code: String) -> String {
        String(localized: "Masalcık'ta çocuğumuz her gece kendi masalının kahramanı oluyor. Uygulamayı indirip Ebeveyn Köşesi › Hesap bölümüne \(code) kodunu yazarsan ikimiz de 1 hafta Premium kazanırız: \(AppConfig.appStoreURL.absoluteString)")
    }

    /// Sunucuyla aynı kural: boşluk/tire atılır, 6 harf/rakam (Türkçe klavyede "i" → "I").
    static func normalized(_ input: String) -> String? {
        let code = input.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "-", with: "")
            .uppercased(with: Locale(identifier: "en_US_POSIX"))
        return code.count == 6 && code.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber) }) ? code : nil
    }

    private func redeem() async {
        guard let code = Self.normalized(input) else { return }
        redeeming = true
        defer { redeeming = false }
        do {
            let r = try await appState.api.redeemReferral(code: code)
            input = ""
            result = .success(r.premiumUntil.formatted(.dateTime.day().month(.wide)))
            if let dto = try? await appState.api.verifyEntitlement(signedTransaction: nil) {
                EntitlementSync.apply(dto, to: family)
            }
        } catch APIError.referralRejected(let reason) {
            result = .rejected(reason)
        } catch {
            result = .failed
        }
    }
}
