import XCTest

/// Performans ölçümleri (gerçek cihazda Release ile çalıştırın; simülatör değerleri yalnızca eğilim gösterir).
final class PerformanceUITests: MasalcikUITestCase {
    /// Hedef: soğuk açılış < 1,5 sn (iPhone 12 sınıfı).
    func testSogukAcilis() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "-parentGateAnswer", "63"]
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            app.launch()
        }
    }

    /// Haritada kaydırma: kare atlama ve CPU (Instruments'ta "MapAppear" imi ile birlikte).
    func testHaritaKaydirma() {
        launch()
        let lock = app.buttons["map.parentZone"]
        XCTAssertTrue(lock.waitForExistence(timeout: 10))
        let map = app.otherElements["Masal Adası"]
        let options = XCTMeasureOptions()
        options.iterationCount = 5
        measure(metrics: [XCTOSSignpostMetric.scrollingAndDecelerationMetric, XCTCPUMetric(application: app)],
                options: options) {
            map.swipeUp(velocity: .fast)
            map.swipeDown(velocity: .fast)
        }
    }
}
