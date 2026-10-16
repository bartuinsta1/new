import XCTest

/// Ortak başlatma: bellek içi veri, sahte backend ve satın alma, sabit ebeveyn kapısı sorusu (63), Türkçe.
class MasalcikUITestCase: XCTestCase {
    static let gateAnswer = 63
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @discardableResult
    func launch(state: String = "freeAfterFirstStory", language: String = "tr") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-uiTesting", "-uiTestingState", state, "-parentGateAnswer", String(Self.gateAnswer),
            "-AppleLanguages", "(\(language))", "-AppleLocale", language == "tr" ? "tr_TR" : "en_GB",
        ]
        app.launch()
        self.app = app
        return app
    }

    /// Ebeveyn kapısına rakamları yazar.
    func type(_ number: Int) {
        for digit in String(number) {
            let key = app.buttons["gate.key.\(digit)"]
            XCTAssertTrue(key.waitForExistence(timeout: 3), "tuş \(digit) yok")
            key.tap()
        }
    }

    /// Haritadan Ebeveyn Köşesi'ne girer.
    func openParentZone() {
        let lock = app.buttons["map.parentZone"]
        XCTAssertTrue(lock.waitForExistence(timeout: 10))
        lock.tap()
        type(Self.gateAnswer)
    }
}
