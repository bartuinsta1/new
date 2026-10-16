import XCTest

/// Ebeveyn kapısı (§3.8): satın alma, ayarlar ve dış bağlantılar hep bunun arkasında.
final class ParentGateUITests: MasalcikUITestCase {
    func testYanlisYanitKapiyiAcmaz() {
        launch()
        let lock = app.buttons["map.parentZone"]
        XCTAssertTrue(lock.waitForExistence(timeout: 10))
        lock.tap()
        type(11)
        // Kapı hâlâ açık değil: soru ve tuş takımı yerinde, Ebeveyn Köşesi sekmeleri yok.
        XCTAssertTrue(app.staticTexts["gate.prompt"].exists)
        XCTAssertTrue(app.buttons["gate.key.1"].exists)
        XCTAssertFalse(app.tabBars.firstMatch.exists)
    }

    func testDogruYanitEbeveynKosesiniAcar() {
        launch()
        openParentZone()
        XCTAssertTrue(app.tabBars.buttons["Çocuklar"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.tabBars.buttons["Hesap"].exists)
    }

    func testSilTusuVeKapatma() {
        launch()
        app.buttons["map.parentZone"].tap()
        type(6)
        app.buttons["gate.delete"].tap()
        type(Self.gateAnswer)               // silindikten sonra tam yanıt hâlâ çalışır
        XCTAssertTrue(app.tabBars.firstMatch.waitForExistence(timeout: 5))
    }

    func testKapatincaHaritayaDoner() {
        launch()
        app.buttons["map.parentZone"].tap()
        let close = app.buttons["gate.close"]
        XCTAssertTrue(close.waitForExistence(timeout: 3))
        close.tap()
        XCTAssertTrue(app.buttons["map.parentZone"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.buttons["gate.key.1"].exists)
    }

    /// Onboarding'deki kapı da sorulur; onboarding sonunda Paywall çıkmaz (§3.1).
    func testOnboardingdeKapiVarPaywallYok() {
        launch(state: "onboarding")
        let start = app.buttons["onboarding.primary"]
        XCTAssertTrue(start.waitForExistence(timeout: 10))
        start.tap()
        XCTAssertTrue(app.buttons["gate.key.1"].waitForExistence(timeout: 3))
        type(Self.gateAnswer)
        XCTAssertTrue(app.buttons["onboarding.primary"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.buttons["paywall.close"].exists)
    }
}
