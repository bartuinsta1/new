import SwiftUI
import SwiftData

/// Paywall (§3.9) — her zaman ebeveyn kapısının arkasında: Ebeveyn Köşesi > Hesap'tan ya da çocuk tarafındaki
/// "Ebeveynler için" bağlantısından `GatedPaywallSheet` ile. Pamuk'lu, sakin, gündüz paletinde; çocuk dili yok,
/// ebeveyne yazılmış açık bir ekran. Kapatma (X) ilk karede görünür ve her durumda çalışır.
struct PaywallView: View {
    var onClose: () -> Void
    /// Önizleme/test için; nil ise uygulamanın StoreKit servisi kullanılır.
    var service: PurchaseService?

    @Environment(AppState.self) private var appState
    @Environment(\.theme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Query private var families: [Family]
    @State private var model: PaywallModel?

    /// - Parameter preloaded: snapshot testleri için fiyatları yüklenmiş model (yükleme ekranı atlanır).
    init(onClose: @escaping () -> Void, service: PurchaseService? = nil, preloaded: PaywallModel? = nil) {
        self.onClose = onClose
        self.service = service
        _model = State(initialValue: preloaded)
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            theme.background.ignoresSafeArea()
            if let model {
                content(model)
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            closeButton
        }
        .task {
            guard model == nil else { return }
            let m = PaywallModel(service: service ?? appState.purchases) { dto in
                if let family = families.first { EntitlementSync.apply(dto, to: family) }
            }
            model = m
            Analytics.shared.track(.paywallShown)
            await m.load()
        }
    }

    private var closeButton: some View {
        Button {
            Analytics.shared.track(.paywallClosed)
            onClose()
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(theme.ink)
                .frame(width: 44, height: 44)
                .background(Circle().fill(theme.surface))
                .overlay(Circle().stroke(theme.outline, lineWidth: 2))
        }
        .padding(Metrics.spacingM)
        .accessibilityLabel(Text("Kapat"))
        .accessibilityIdentifier("paywall.close")
        .accessibilitySortPriority(10) // VoiceOver'da ilk öğe
    }

    @ViewBuilder private func content(_ model: PaywallModel) -> some View {
        switch model.phase {
        case .purchased:
            PaywallDoneView(isTrial: (families.first?.entitlement?.isInTrial ?? false), onClose: onClose)
        case .pending:
            PaywallMessageView(
                title: Text("Onay bekleniyor"),
                message: Text("Satın alma bir onay bekliyor (ör. Aile Paylaşımı'nda “Satın Almadan Önce Sor”). Onaylandığında Premium kendiliğinden açılır."),
                onClose: onClose)
        default:
            offer(model)
        }
    }

    private func offer(_ model: PaywallModel) -> some View {
        ScrollView {
            VStack(spacing: Metrics.spacingL) {
                header
                ComparisonCard()
                if model.phase == .unavailable {
                    unavailable(model)
                } else {
                    plans(model)
                    purchaseButton(model)
                    finePrint(model)
                }
                footer(model)
            }
            .padding(.horizontal, Metrics.spacingM)
            .padding(.top, 56)
            .padding(.bottom, Metrics.spacingXL)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .alert(item: Binding(get: { model.notice.map(NoticeBox.init) }, set: { model.notice = $0?.notice })) { box in
            alert(for: box.notice)
        }
    }

    private var header: some View {
        VStack(spacing: Metrics.spacingS) {
            CharacterView(character: .pamuk, mood: .sleepy, size: 120, isInteractive: false)
                .accessibilityHidden(true)
            Text(verbatim: "\(AppConfig.appName) Premium")
                .masalFont(.title)
                .foregroundStyle(theme.ink)
                .accessibilityAddTraits(.isHeader)
            Text("Her gece ona özel, yepyeni bir masal.")
                .masalFont(.body)
                .foregroundStyle(theme.secondaryInk)
                .multilineTextAlignment(.center)
        }
    }

    private func plans(_ model: PaywallModel) -> some View {
        VStack(spacing: Metrics.spacingS) {
            ForEach(model.products) { product in
                PlanCard(product: product, isSelected: product.id == model.selectedID,
                         savingsPercent: product.period == .year ? model.yearlySavingsPercent : nil) {
                    model.select(product)
                }
                .disabled(model.isBusy)
            }
        }
    }

    private func purchaseButton(_ model: PaywallModel) -> some View {
        Button {
            Task { await model.purchase() }
        } label: {
            Group {
                if model.phase == .purchasing {
                    ProgressView().tint(Palette.ink)
                } else if let days = model.selected?.trialDays {
                    Text("\(days) gün ücretsiz dene")
                } else {
                    Text("Abone ol")
                }
            }
            .masalFont(.headline)
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: .infinity, minHeight: Metrics.minTapTarget)
        }
        .buttonStyle(BubbleButtonStyle(color: .sun))
        .disabled(model.selected == nil || model.isBusy)
        .accessibilityIdentifier("paywall.purchase")
    }

    /// Fiyat, dönem ve deneme bitişi düğmenin hemen altında, okunur puntoyla (gizli küçük yazı değil).
    @ViewBuilder private func finePrint(_ model: PaywallModel) -> some View {
        if let product = model.selected {
            VStack(spacing: Metrics.spacingS) {
                let price = product.displayPrice
                if let end = model.trialEndDate {
                    let date = end.formatted(.dateTime.day().month(.wide).year())
                    Text("Ücretsiz deneme bitişi: \(date)")
                        .masalFont(.bodyBold)
                        .foregroundStyle(theme.ink)
                        .accessibilityIdentifier("paywall.trialEnd")
                    if product.period == .year {
                        Text("Bu tarihten önce iptal ederseniz hiçbir ücret alınmaz. Sonra yılda \(price) ödenir ve her yıl otomatik yenilenir.")
                    } else {
                        Text("Bu tarihten önce iptal ederseniz hiçbir ücret alınmaz. Sonra ayda \(price) ödenir ve her ay otomatik yenilenir.")
                    }
                } else if product.period == .year {
                    Text("Yılda \(price) ödenir ve her yıl otomatik yenilenir.")
                } else {
                    Text("Ayda \(price) ödenir ve her ay otomatik yenilenir.")
                }
                Text("İstediğiniz an iPhone Ayarları › Apple Hesabı › Abonelikler bölümünden iki dokunuşla iptal edebilirsiniz.")
                    .accessibilityIdentifier("paywall.cancelInfo")
            }
            .masalFont(.body)
            .foregroundStyle(theme.secondaryInk)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func unavailable(_ model: PaywallModel) -> some View {
        VStack(spacing: Metrics.spacingM) {
            Text("Fiyatlar şu an yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.")
                .masalFont(.body)
                .foregroundStyle(theme.secondaryInk)
                .multilineTextAlignment(.center)
            Button {
                Task { await model.load() }
            } label: {
                Text("Tekrar dene").masalFont(.bodyBold).padding(.horizontal, Metrics.spacingL)
                    .frame(minHeight: Metrics.minTapTarget)
            }
            .buttonStyle(BubbleButtonStyle(color: .sky))
        }
    }

    private func footer(_ model: PaywallModel) -> some View {
        VStack(spacing: Metrics.spacingS) {
            Button {
                Task { await model.restore() }
            } label: {
                if model.phase == .restoring { ProgressView() } else { Text("Satın alımları geri yükle") }
            }
            .masalFont(.bodyBold)
            .frame(minHeight: 44)
            .disabled(model.isBusy)
            HStack(spacing: Metrics.spacingL) {
                Link(destination: AppConfig.termsOfUseURL) { Text("Kullanım Koşulları") }
                Link(destination: AppConfig.privacyPolicyURL()) { Text("Gizlilik Politikası") }
            }
            .masalFont(.caption)
            Text("Reklam yok, kredi ya da jeton yok. Tek abonelik, tüm aile için (4 çocuğa kadar).")
                .masalFont(.caption)
                .foregroundStyle(theme.secondaryInk)
                .multilineTextAlignment(.center)
        }
        .tint(theme.ink)
    }

    private func alert(for notice: PaywallModel.Notice) -> Alert {
        switch notice {
        case .purchaseFailed:
            Alert(title: Text("Satın alma tamamlanamadı"),
                  message: Text("Ödeme alındıysa Premium birkaç dakika içinde kendiliğinden açılır. Açılmazsa “Satın alımları geri yükle”ye dokunun."))
        case .nothingToRestore:
            Alert(title: Text("Abonelik bulunamadı"),
                  message: Text("Bu Apple Hesabında etkin bir Masalcık aboneliği yok."))
        case .restoreFailed:
            Alert(title: Text("Geri yüklenemedi"),
                  message: Text("İnternet bağlantınızı kontrol edip tekrar deneyin."))
        case .restored:
            Alert(title: Text("Aboneliğiniz geri yüklendi"))
        }
    }
}

private struct NoticeBox: Identifiable {
    let notice: PaywallModel.Notice
    var id: String { "\(notice)" }
}

/// Ücretsiz ve Premium'da neler olduğu — yan yana, abartısız.
private struct ComparisonCard: View {
    @Environment(\.theme) private var theme
    @Environment(\.dynamicTypeSize) private var typeSize

    private struct Feature: Identifiable {
        let id: Int
        let title: Text
        let free: Text
        let premium: Text
    }

    private var features: [Feature] {
        [
            Feature(id: 0, title: Text("Kişisel masal"), free: Text("Günde 1"), premium: Text("Günde 10'a kadar")),
            Feature(id: 1, title: Text("Hazır kitaplık"), free: Text("Haftada 3 masal"), premium: Text("Tüm masallar")),
            Feature(id: 2, title: Text("Sizin sesinizle masal"), free: Text("Yok"), premium: Text("Var")),
            Feature(id: 3, title: Text("Masal Adası, ninni, uyku zamanlayıcı, Hazine Sandığı"), free: Text("Var"), premium: Text("Var")),
        ]
    }

    var body: some View {
        Group {
            // Büyük yazı boyutlarında üç sütun sığmaz: her özellik alt alta "Ücretsiz / Premium" satırlarıyla gösterilir.
            if typeSize >= .xxLarge { stacked } else { grid }
        }
        .padding(Metrics.spacingM)
        .background(RoundedRectangle(cornerRadius: Metrics.cardRadius).fill(theme.surface))
        .overlay(RoundedRectangle(cornerRadius: Metrics.cardRadius).stroke(theme.outline, lineWidth: Metrics.outlineWidth))
    }

    private var grid: some View {
        Grid(alignment: .leading, horizontalSpacing: Metrics.spacingS, verticalSpacing: Metrics.spacingS) {
            GridRow {
                Color.clear.frame(height: 1).gridCellUnsizedAxes([.horizontal, .vertical])
                Text("Ücretsiz").masalFont(.caption).foregroundStyle(theme.secondaryInk)
                    .gridColumnAlignment(.center)
                Text(verbatim: "Premium").masalFont(.caption).foregroundStyle(Palette.grapeText)
                    .gridColumnAlignment(.center)
            }
            Divider()
            ForEach(features) { f in
                GridRow {
                    f.title.masalFont(.body).foregroundStyle(theme.ink).fixedSize(horizontal: false, vertical: true)
                    f.free.masalFont(.caption).foregroundStyle(theme.secondaryInk).multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                    f.premium.masalFont(.caption).foregroundStyle(theme.ink).multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                // Not: GridRow'a değiştirici eklenmez (Grid satırı tanımaz, tek hücreye çöker).
            }
        }
    }

    private var stacked: some View {
        VStack(alignment: .leading, spacing: Metrics.spacingM) {
            ForEach(features) { f in
                VStack(alignment: .leading, spacing: 4) {
                    f.title.masalFont(.bodyBold).foregroundStyle(theme.ink)
                    (Text("Ücretsiz") + Text(verbatim: ": ") + f.free)
                        .masalFont(.caption).foregroundStyle(theme.secondaryInk)
                    (Text(verbatim: "Premium: ") + f.premium)
                        .masalFont(.caption).foregroundStyle(theme.ink)
                }
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

private struct PlanCard: View {
    let product: PaywallProduct
    let isSelected: Bool
    let savingsPercent: Int?
    let action: () -> Void
    @Environment(\.theme) private var theme
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // Büyük yazı boyutlarında fiyat başlığın altına iner; satır sıkışıp metin kırpılmasın.
        let large = typeSize >= .xxLarge
        let row = large ? AnyLayout(VStackLayout(alignment: .leading, spacing: Metrics.spacingS))
                        : AnyLayout(HStackLayout(spacing: Metrics.spacingM))
        let title = large ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
                          : AnyLayout(HStackLayout(spacing: Metrics.spacingS))
        Button(action: action) {
            row {
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(isSelected ? Palette.grape : theme.secondaryInk)
                VStack(alignment: .leading, spacing: 2) {
                    title {
                        if product.period == .year { Text("Yıllık") } else { Text("Aylık") }
                        if product.period == .year {
                            Text("En avantajlı")
                                .masalFont(.caption)
                                .foregroundStyle(Palette.ink)
                                .padding(.horizontal, 8).padding(.vertical, 2)
                                .background(Capsule().fill(Palette.sun))
                        }
                    }
                    .masalFont(.headline)
                    .foregroundStyle(theme.ink)
                    if product.period == .year {
                        let perMonth = product.monthlyEquivalent
                        if let percent = savingsPercent {
                            // "%53" (tr) / "53%" (en): yüzde biçimi dile göre.
                            let savings = (Double(percent) / 100).formatted(.percent)
                            Text("Ayda yaklaşık \(perMonth) · aylığa göre \(savings) daha uygun")
                        } else {
                            Text("Ayda yaklaşık \(perMonth)")
                        }
                    }
                }
                .masalFont(.caption)
                .foregroundStyle(theme.secondaryInk)
                .fixedSize(horizontal: false, vertical: true)
                if !large { Spacer(minLength: 0) }
                Text(verbatim: product.displayPrice)
                    .masalFont(.headline)
                    .foregroundStyle(theme.ink)
            }
            .padding(Metrics.spacingM)
            .frame(maxWidth: .infinity, minHeight: Metrics.minTapTarget, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: Metrics.cardRadius).fill(theme.surface))
            .overlay(RoundedRectangle(cornerRadius: Metrics.cardRadius)
                .stroke(isSelected ? Palette.grape : theme.outline, lineWidth: isSelected ? 4 : 2))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier("paywall.plan.\(product.id)")
    }
}

private struct PaywallDoneView: View {
    let isTrial: Bool
    var onClose: () -> Void
    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: Metrics.spacingL) {
            CharacterView(character: .pamuk, mood: .happy, size: 160, isInteractive: false)
                .accessibilityHidden(true)
            Text("Premium açıldı").masalFont(.title).foregroundStyle(theme.ink)
                .accessibilityIdentifier("paywall.done")
            Group {
                if isTrial {
                    Text("Deneme bitmeden bir gün önce App Store size hatırlatır. İyi geceler, tatlı masallar!")
                } else {
                    Text("Teşekkür ederiz. İyi geceler, tatlı masallar!")
                }
            }
            .masalFont(.body)
            .foregroundStyle(theme.secondaryInk)
            .multilineTextAlignment(.center)
            Button(action: onClose) {
                Text("Tamam").masalFont(.headline).foregroundStyle(Palette.ink)
                    .frame(maxWidth: 280, minHeight: Metrics.minTapTarget)
            }
            .buttonStyle(BubbleButtonStyle(color: .grass))
        }
        .padding(Metrics.spacingL)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct PaywallMessageView: View {
    let title: Text
    let message: Text
    var onClose: () -> Void
    @Environment(\.theme) private var theme

    var body: some View {
        VStack(spacing: Metrics.spacingL) {
            CharacterView(character: .pamuk, mood: .sleepy, size: 140, isInteractive: false)
                .accessibilityHidden(true)
            title.masalFont(.title).foregroundStyle(theme.ink)
            message.masalFont(.body).foregroundStyle(theme.secondaryInk).multilineTextAlignment(.center)
            Button(action: onClose) {
                Text("Tamam").masalFont(.headline).foregroundStyle(Palette.ink)
                    .frame(maxWidth: 280, minHeight: Metrics.minTapTarget)
            }
            .buttonStyle(BubbleButtonStyle(color: .sky))
        }
        .padding(Metrics.spacingL)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Çocuk tarafından açılan her Paywall önce ebeveyn kapısından geçer (Apple Kids kategorisi, §3.9).
struct GatedPaywallSheet: View {
    var onClose: () -> Void
    @State private var unlocked = false

    var body: some View {
        if unlocked {
            PaywallView(onClose: onClose)
        } else {
            ParentGate(onUnlock: { unlocked = true }, onCancel: onClose)
        }
    }
}

/// Çocuk ekranlarındaki küçük, sakin "Ebeveynler için" bağlantısı (parlak rozet ya da animasyon yok).
struct ForParentsLink: View {
    @State private var showsPaywall = false
    @Environment(\.theme) private var theme

    var body: some View {
        Button { showsPaywall = true } label: {
            Label("Ebeveynler için", systemImage: "lock.fill")
                .masalFont(.caption)
                .foregroundStyle(theme.secondaryInk)
                .frame(minHeight: 44)
        }
        .sheet(isPresented: $showsPaywall) {
            GatedPaywallSheet { showsPaywall = false }
                .themed(.day)
        }
    }
}

#Preview("Paywall") {
    PaywallView(onClose: {}, service: MockPurchaseService())
        .environment(AppState())
        .modelContainer(PersistenceController.preview.container)
        .themed(.day)
}

#Preview("Paywall (English)") {
    PaywallView(onClose: {}, service: MockPurchaseService())
        .environment(AppState())
        .modelContainer(PersistenceController.preview.container)
        .themed(.day)
        .environment(\.locale, Locale(identifier: "en"))
}
