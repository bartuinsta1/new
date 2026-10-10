import Testing
import Foundation
import CoreGraphics
@testable import Masalcik

@Suite("Masal Adası haritası")
struct WorldTests {
    let phone = CGSize(width: 390, height: 844)
    let ipadLandscape = CGSize(width: 1180, height: 820)

    // MARK: Kamera

    @Test func dunyaNoktasiEkranMerkezineGelir() {
        let cam = MapCamera(center: CGPoint(x: 600, y: 610), zoom: 0.7)
        let p = cam.screenPoint(for: CGPoint(x: 600, y: 610), in: phone)
        #expect(abs(p.x - phone.width / 2) < 0.001 && abs(p.y - phone.height / 2) < 0.001)
    }

    @Test func kaydirmaParmagiTakipEder() {
        let cam = MapCamera(center: CGPoint(x: 600, y: 600), zoom: 2)
        let moved = cam.panned(by: CGSize(width: 100, height: -40))
        let before = cam.screenPoint(for: CGPoint(x: 500, y: 500), in: phone)
        let after = moved.screenPoint(for: CGPoint(x: 500, y: 500), in: phone)
        #expect(abs(after.x - before.x - 100) < 0.001)
        #expect(abs(after.y - before.y + 40) < 0.001)
    }

    @Test func yakinlastirmaSinirlanir() {
        let world = WorldLayout.size
        #expect(MapCamera(center: .zero, zoom: 10).clamped(world: world, viewport: phone).zoom == MapCamera.maxZoom)
        let far = MapCamera(center: .zero, zoom: 0.01).clamped(world: world, viewport: phone)
        #expect(far.zoom >= MapCamera.minZoom)
        // En uzakta bile ekran dünyayla dolu: boş kenar yok
        #expect(world.width * far.zoom >= phone.width - 0.001 && world.height * far.zoom >= phone.height - 0.001)
    }

    @Test(arguments: [CGSize(width: 390, height: 844), CGSize(width: 1180, height: 820), CGSize(width: 820, height: 1180)])
    func dunyaDisinaKaydirilamaz(viewport: CGSize) {
        let world = WorldLayout.size
        for zoom in [MapCamera.minZoom, 0.7, 1.0, MapCamera.maxZoom] {
            for center in [CGPoint(x: -500, y: -500), CGPoint(x: 5000, y: 5000), CGPoint(x: 600, y: 600)] {
                let cam = MapCamera(center: center, zoom: zoom).clamped(world: world, viewport: viewport)
                let o = cam.origin(in: viewport)
                let worldOnScreen = CGSize(width: world.width * cam.zoom, height: world.height * cam.zoom)
                if worldOnScreen.width >= viewport.width {
                    #expect(o.x <= 0.001 && o.x + worldOnScreen.width >= viewport.width - 0.001)
                }
                if worldOnScreen.height >= viewport.height {
                    #expect(o.y <= 0.001 && o.y + worldOnScreen.height >= viewport.height - 0.001)
                }
            }
        }
    }

    @Test func odaklanmaBolgeyiKartlarinUstuneTasir() {
        let target = WorldLayout.position(of: .feelingsGarden)
        let cam = MapCamera.focusing(on: target, viewport: phone, verticalBias: 0.18).clamped(world: WorldLayout.size, viewport: phone)
        let p = cam.screenPoint(for: target, in: phone)
        #expect(abs(p.x - phone.width / 2) < 0.001)
        #expect(p.y < phone.height / 2)   // ekranın üst yarısında
    }

    @Test func ilkAcilistaKomsuBolgelerGorunur() {
        let zoom = WorldLayout.initialZoom(for: phone)
        let cam = MapCamera(center: WorldLayout.position(of: .sleepHouse), zoom: zoom).clamped(world: WorldLayout.size, viewport: phone)
        for r in [Region.whisperForest, .starHill] {
            let p = cam.screenPoint(for: WorldLayout.position(of: r), in: phone)
            #expect(p.x > 0 && p.x < phone.width, "\(r) ilk ekranda görünmüyor")
        }
        #expect(WorldLayout.initialZoom(for: ipadLandscape) == 1)
    }

    // MARK: Yerleşim

    @Test func tumBolgelerAdaninUstunde() {
        for r in Region.allCases {
            let p = WorldLayout.position(of: r)
            let d = hypot(p.x - WorldLayout.islandCenter.x, p.y - WorldLayout.islandCenter.y)
            #expect(d + WorldLayout.regionSize / 2 < WorldLayout.islandRadius * 0.95, "\(r) adanın dışına taşıyor")
        }
    }

    @Test func bolgelerUstUsteBinmez() {
        let all = Region.allCases
        for (i, a) in all.enumerated() {
            for b in all.dropFirst(i + 1) {
                let pa = WorldLayout.position(of: a), pb = WorldLayout.position(of: b)
                #expect(hypot(pa.x - pb.x, pa.y - pb.y) >= WorldLayout.regionSize, "\(a) ile \(b) çakışıyor")
            }
        }
    }

    // MARK: İlerleme

    @Test func bolgelerDinledikceAcilir() {
        #expect(RegionUnlocks.isUnlocked(.whisperForest, listenedStories: 0))
        #expect(RegionUnlocks.isUnlocked(.storytellerPlane, listenedStories: 0))
        #expect(!RegionUnlocks.isUnlocked(.starHill, listenedStories: 0))
        #expect(RegionUnlocks.isUnlocked(.starHill, listenedStories: 1))
        #expect(!RegionUnlocks.isUnlocked(.lighthouseCove, listenedStories: 1))
        #expect(!RegionUnlocks.isUnlocked(.feelingsGarden, listenedStories: 2))
        #expect(RegionUnlocks.isUnlocked(.feelingsGarden, listenedStories: 0, hasValueTopics: true))
    }

    @Test func uykuSaatiYaklasinca() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Istanbul")!
        func at(_ h: Int, _ m: Int) -> Date { cal.date(from: DateComponents(year: 2026, month: 10, day: 10, hour: h, minute: m))! }
        let bed = Bedtime(hour: 20, minute: 0)
        #expect(!BedtimeNudge.isNear(at(19, 29), bedtime: bed, calendar: cal))
        #expect(BedtimeNudge.isNear(at(19, 30), bedtime: bed, calendar: cal))
        #expect(BedtimeNudge.isNear(at(21, 59), bedtime: bed, calendar: cal))
        #expect(!BedtimeNudge.isNear(at(22, 1), bedtime: bed, calendar: cal))
        // Gece yarısını aşan uyku saati
        let late = Bedtime(hour: 23, minute: 45)
        #expect(BedtimeNudge.isNear(at(0, 30), bedtime: late, calendar: cal))
    }

    @MainActor
    @Test func bolgeKartlariEnFazlaAltiVeUcretsizlerOnce() async {
        let model = WorldViewModel(api: MockStoryAPI(paragraphDelay: .zero, language: .tr))
        await model.load()
        for r in Region.allCases {
            let items = model.stories(for: r)
            #expect(items.count <= 6)
            if let firstPaid = items.firstIndex(where: { !$0.isFree }) {
                #expect(items[firstPaid...].allSatisfy { !$0.isFree })
            }
        }
        let paid = model.stories(for: .storytellerPlane).first { !$0.isFree }!
        #expect(model.isSleeping(paid))
        model.isPremium = true
        #expect(!model.isSleeping(paid))
    }
}
