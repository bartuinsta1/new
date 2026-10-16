import Testing
import SwiftUI
import SwiftData
import SnapshotTesting
@testable import Masalcik

/// Görsel regresyon testleri (pointfreeco/swift-snapshot-testing).
/// İlk çalıştırmada referans görseller `__Snapshots__/` altına kaydedilir (record: .missing) ve test bir kez
/// "kayıt yapıldı" diye başarısız olur; ikinci çalıştırmadan itibaren karşılaştırır.
/// Referanslar tek bir simülatörde üretilmeli (iPhone 15, iOS 17.5) — farklı cihaz/OS piksel farkı verir.
/// Bilerek yalnızca deterministik ekranlar: zamanla değişen gökyüzü ve harita animasyonları yok.
@Suite("Görsel", .serialized)
@MainActor
struct SnapshotTests {
    private let container = PersistenceController(inMemory: true, seed: true).container
    /// 12 Ekim 2026 12:00 İstanbul → deneme bitişi 19 Ekim 2026.
    private let now = Date(timeIntervalSince1970: 1_791_795_600)

    private func snap<V: View>(_ view: V, named name: String, mode: DisplayMode = .day,
                               locale: String = "tr_TR", size: UIContentSizeCategory = .large) {
        let root = view
            .themed(mode)
            .environment(AppState.uiTesting())
            .environment(\.locale, Locale(identifier: locale))
            .modelContainer(container)
        withSnapshotTesting(record: .missing) {
            assertSnapshot(of: UIHostingController(rootView: root),
                           as: .image(on: .iPhone13, precision: 0.99, perceptualPrecision: 0.98,
                                      traits: UITraitCollection(preferredContentSizeCategory: size)),
                           named: name, testName: "snapshot")
        }
    }

    private func loadedPaywall() async -> PaywallModel {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Istanbul")!
        let model = PaywallModel(service: MockPurchaseService(), now: { now }, calendar: cal)
        await model.load()
        return model
    }

    @Test func paywallTurkce() async {
        snap(PaywallView(onClose: {}, preloaded: await loadedPaywall()), named: "paywall-tr")
    }

    @Test func paywallIngilizce() async {
        snap(PaywallView(onClose: {}, preloaded: await loadedPaywall()), named: "paywall-en", locale: "en_GB")
    }

    /// Büyük yazı (Erişilebilirlik XL): ebeveyn ekranı kırpılmadan kaymalı.
    @Test func paywallBuyukYazi() async {
        snap(PaywallView(onClose: {}, preloaded: await loadedPaywall()), named: "paywall-tr-axl",
             size: .accessibilityExtraLarge)
    }

    @Test(arguments: [DisplayMode.day, .night])
    func ebeveynKapisi(mode: DisplayMode) {
        let gate = ParentGate(onUnlock: {}, onCancel: {}, makeChallenge: { ParentGateChallenge(answer: 63, language: .tr) })
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.forMode(mode).background)
        snap(gate, named: "gate-\(mode.rawValue)", mode: mode)
    }

    @Test(arguments: [DisplayMode.day, .night])
    func masalKartlari(mode: DisplayMode) {
        let cards = VStack(spacing: 16) {
            HStack(spacing: 16) {
                StoryCard(title: "Keloğlan ile Sihirli Kaşık", region: .storytellerPlane, durationMinutes: 10,
                          characters: [.pamuk], width: 160)
                StoryCard(title: "Yıldız'ın İlk Gecesi", region: .starHill, durationMinutes: 15,
                          characters: [.yildiz], isSleeping: true, width: 160)
            }
            HStack(spacing: 16) {
                StoryCard(title: "Fısıldayan Yapraklar", region: .whisperForest, durationMinutes: 5,
                          characters: [.findik], isFavorite: true, width: 160)
                StoryCard(title: "Fenerin Uykucu Işığı", region: .lighthouseCove, durationMinutes: 5,
                          characters: [.kaptanMidye], width: 160)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.forMode(mode).background)
        snap(cards, named: "cards-\(mode.rawValue)", mode: mode)
    }

    @Test(arguments: [DisplayMode.day, .night])
    func karakterlerVeDugmeler(mode: DisplayMode) {
        let view = VStack(spacing: 20) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 12) {
                ForEach(CharacterID.allCases, id: \.self) { c in
                    CharacterView(character: c, mood: mode == .night ? .sleepy : .happy, size: 100, isInteractive: false)
                }
            }
            HStack(spacing: 12) {
                ForEach(AccentColor.allCases, id: \.self) { color in
                    BubbleButton(systemImage: "star.fill", color: color, accessibilityLabel: "Yıldız") {}
                }
            }
            BubbleButton("Yeni masal", systemImage: "sparkles", color: .grape, size: .large) {}
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.forMode(mode).background)
        snap(view, named: "components-\(mode.rawValue)", mode: mode)
    }
}
