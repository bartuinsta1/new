import SwiftUI
import SwiftData

/// Masal Dükkanı (Ebeveyn Köşesi › Hesap). Ebeveyn ekranı: standart Form, Dynamic Type ve VoiceOver tam.
struct ShopView: View {
    @Bindable var family: Family
    /// Önizleme/test için; nil ise uygulamanın satın alma servisi.
    var service: PurchaseService?

    @Environment(AppState.self) private var appState
    @State private var model: ShopModel?

    var body: some View {
        Group {
            if let model {
                content(model)
            } else {
                ProgressView()
            }
        }
        .navigationTitle(Text("Masal Dükkanı"))
        .task {
            guard model == nil else { return }
            let family = family
            let m = ShopModel(api: appState.api, service: service ?? appState.purchases,
                              ownedLocally: { Set(family.entitlement?.ownedProductIDs ?? []) },
                              onEntitlement: { EntitlementSync.apply($0, to: family) })
            model = m
            await m.load()
        }
    }

    @ViewBuilder private func content(_ model: ShopModel) -> some View {
        Form {
            Section {
                Label("Bir kez alınır, hep sizde kalır. Jeton ya da kredi yok.", systemImage: "checkmark.seal.fill")
                Label("Aile Paylaşımı açık: ailenizdeki cihazlarda da açılır.", systemImage: "person.2.fill")
                Label("Paketler Premium aboneliğe dahil değildir; ayrı satın alınır.", systemImage: "info.circle")
            }
            .font(.subheadline)

            switch model.phase {
            case .loading:
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            case .unavailable:
                Section {
                    Text("Dükkân şu an açılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.")
                    Button("Tekrar dene") { Task { await model.load() } }
                }
            case .ready:
                ForEach(model.items) { item in
                    PackSection(item: item, owned: model.isOwned(item), buying: model.buying == item.id,
                                disabled: model.buying != nil || model.restoring) {
                        Task { await model.buy(item) }
                    }
                }
            }

            Section {
                Button {
                    Task { await model.restore() }
                } label: {
                    if model.restoring { ProgressView() } else { Text("Satın alımları geri yükle") }
                }
                .disabled(model.restoring || model.buying != nil)
            } footer: {
                Text("Ödeme Apple Hesabınızdan alınır. İade talepleri Apple üzerinden yapılır (reportaproblem.apple.com).")
            }
        }
        .alert(item: Binding(get: { model.notice.map(ShopNoticeBox.init) }, set: { model.notice = $0?.notice })) { box in
            alert(for: box.notice)
        }
    }

    private func alert(for notice: ShopModel.Notice) -> Alert {
        switch notice {
        case .purchased(let title):
            Alert(title: Text("Paket açıldı"), message: Text("\(title) artık Masal Adası'nda."))
        case .pending:
            Alert(title: Text("Onay bekleniyor"),
                  message: Text("Satın alma bir onay bekliyor (ör. Aile Paylaşımı'nda “Satın Almadan Önce Sor”). Onaylandığında paket kendiliğinden açılır."))
        case .failed:
            Alert(title: Text("Satın alma tamamlanamadı"),
                  message: Text("Ödeme alındıysa paket birkaç dakika içinde kendiliğinden açılır. Açılmazsa “Satın alımları geri yükle”ye dokunun."))
        case .restored:
            Alert(title: Text("Satın alımlarınız geri yüklendi"))
        case .nothingToRestore:
            Alert(title: Text("Geri yüklenecek satın alma yok"))
        }
    }
}

private struct ShopNoticeBox: Identifiable {
    let notice: ShopModel.Notice
    var id: String { "\(notice)" }
}

private struct PackSection: View {
    let item: ShopModel.Item
    let owned: Bool
    let buying: Bool
    let disabled: Bool
    var onBuy: () -> Void

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Label {
                    Text(verbatim: item.pack.title).font(.headline)
                } icon: {
                    Image(systemName: item.pack.kind == .stories ? "books.vertical.fill" : "tshirt.fill")
                        .foregroundStyle(Palette.grapeText)
                }
                Text(verbatim: item.pack.description).font(.subheadline).foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
            .accessibilityElement(children: .combine)

            ForEach(item.pack.stories) { story in
                LabeledContent {
                    Text("\(story.durationMinutes) dk")
                } label: {
                    Label { Text(verbatim: story.title) } icon: { Image(systemName: "moon.stars") }
                }
            }
            ForEach(item.pack.outfits, id: \.self) { key in
                if let outfit = Outfit.find(key) {
                    Label { Text(verbatim: outfit.title) } icon: { Image(systemName: "sparkles") }
                }
            }

            if owned {
                Label("Sizde", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(Palette.grass.darkened(0.35))
                    .accessibilityIdentifier("shop.owned.\(item.id)")
            } else if let price = item.price {
                Button(action: onBuy) {
                    HStack {
                        Text("Satın al")
                        Spacer()
                        if buying { ProgressView() } else { Text(verbatim: price).bold() }
                    }
                }
                .disabled(disabled)
                .accessibilityIdentifier("shop.buy.\(item.id)")
            } else {
                Text("Bu paket şu an satın alınamıyor.").foregroundStyle(.secondary)
            }
        }
    }
}

#Preview("Masal Dükkanı") {
    let container = PersistenceController.preview.container
    let family = try! container.mainContext.fetch(FetchDescriptor<Family>()).first!
    return NavigationStack { ShopView(family: family, service: MockPurchaseService()) }
        .environment(AppState.uiTesting())
        .modelContainer(container)
}
