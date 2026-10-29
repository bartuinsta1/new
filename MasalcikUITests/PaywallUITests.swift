import XCTest

/// Paywall (§3.9): kapatma ilk saniyeden görünür, fiyat ve deneme bitişi açık, satın alma kapının arkasında.
final class PaywallUITests: MasalcikUITestCase {
    private func openPaywall() {
        openParentZone()
        let account = app.tabBars.buttons["Hesap"]
        XCTAssertTrue(account.waitForExistence(timeout: 5))
        account.tap()
        let show = app.buttons["account.showPaywall"]
        XCTAssertTrue(show.waitForExistence(timeout: 3))
        show.tap()
    }

    func testKapatmaDugmesiHemenGorunur() {
        launch()
        openPaywall()
        // "İlk saniyeden": yükleme sürerken bile X ekranda (gecikmeli X bir karanlık desendir).
        let close = app.buttons["paywall.close"]
        XCTAssertTrue(close.waitForExistence(timeout: 1))
        XCTAssertTrue(close.isHittable)
        close.tap()
        XCTAssertFalse(close.waitForExistence(timeout: 1))
        XCTAssertTrue(app.buttons["account.showPaywall"].exists)
    }

    func testFiyatDenemeBitisiVeIptalBilgisi() {
        launch()
        openPaywall()
        XCTAssertTrue(app.buttons["paywall.plan.masalcik.premium.yearly"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["paywall.plan.masalcik.premium.monthly"].exists)
        XCTAssertTrue(app.staticTexts["paywall.trialEnd"].exists)
        XCTAssertTrue(app.staticTexts["paywall.cancelInfo"].exists)
        XCTAssertTrue(app.buttons["Satın alımları geri yükle"].exists)
        // Yıllık plan seçili ve rozetli; aylık da aynı ekranda seçilebilir.
        XCTAssertTrue(app.buttons["paywall.plan.masalcik.premium.yearly"].isSelected)
        app.buttons["paywall.plan.masalcik.premium.monthly"].tap()
        XCTAssertTrue(app.buttons["paywall.plan.masalcik.premium.monthly"].isSelected)
        XCTAssertTrue(app.staticTexts["paywall.trialEnd"].exists)
    }

    func testSahteSatinAlmaPremiumuAcar() {
        launch()
        openPaywall()
        let buy = app.buttons["paywall.purchase"]
        XCTAssertTrue(buy.waitForExistence(timeout: 3))
        buy.tap()
        XCTAssertTrue(app.staticTexts["paywall.done"].waitForExistence(timeout: 5))
        app.buttons["Tamam"].tap()
        // Hesap sekmesi artık Premium gösterir; "Premium'u incele" yerine abonelik yönetimi.
        XCTAssertFalse(app.buttons["account.showPaywall"].waitForExistence(timeout: 2))
    }

    func testIngilizcePaywall() {
        launch(language: "en")
        openParentZoneEnglish()
        app.buttons["account.showPaywall"].tap()
        XCTAssertTrue(app.buttons["paywall.close"].waitForExistence(timeout: 1))
        XCTAssertTrue(app.buttons["Restore purchases"].waitForExistence(timeout: 3))
    }

    private func openParentZoneEnglish() {
        openParentZone()
        let account = app.tabBars.buttons["Account"]
        XCTAssertTrue(account.waitForExistence(timeout: 5))
        account.tap()
    }
}

/// Masal Dükkanı: ebeveyn kapısının arkasında, tek seferlik paket satın alma (sahte satın alma servisiyle).
final class ShopUITests: MasalcikUITestCase {
    func testPaketSatinAlinir() {
        launch()
        openParentZone()
        let account = app.tabBars.buttons["Hesap"]
        XCTAssertTrue(account.waitForExistence(timeout: 5))
        account.tap()
        let shop = app.buttons["account.shop"]
        XCTAssertTrue(shop.waitForExistence(timeout: 3))
        shop.tap()
        let buy = app.buttons["shop.buy.masalcik.pack.space"]
        if !buy.waitForExistence(timeout: 5) { app.swipeUp() }
        XCTAssertTrue(buy.waitForExistence(timeout: 3))
        buy.tap()
        XCTAssertTrue(app.alerts.firstMatch.waitForExistence(timeout: 5), "satın alma onayı")
        app.alerts.firstMatch.buttons.firstMatch.tap()
        XCTAssertTrue(app.descendants(matching: .any)["shop.owned.masalcik.pack.space"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.buttons["shop.buy.masalcik.pack.space"].exists)
    }
}
