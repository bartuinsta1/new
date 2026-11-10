import XCTest

/// Uygulamayı gerçek simülatörde gezip ekran görüntüsü alır (CI: .github/workflows/bunedir-screens.yml).
/// Görüntüler xcresult ekleri olarak saklanır; iş akışı onları docs/bunedir-ekranlar/ altına yazar.
@MainActor
final class ScreenshotTests: XCTestCase {
    override func setUp() { continueAfterFailure = true }

    private func launch(_ args: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = args
        app.launch()
        return app
    }

    private func shot(_ name: String, wait: TimeInterval = 1.2) {
        Thread.sleep(forTimeInterval: wait)
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    func test01_Bugun() {
        let app = launch()
        shot("01-bugun")
        app.swipeUp(); app.swipeUp()
        shot("02-bugun-hikaye")
    }

    func test02_Sozluk() {
        let app = launch()
        app.tabBars.buttons["Kelimeler"].tap()
        shot("03-sozluk")
        app.buttons["Japonca"].firstMatch.tap()
        shot("04-sozluk-japonca")
        app.cells.element(boundBy: 2).tap()
        shot("05-sozluk-kelime")
    }

    func test03_SozlukArama() {
        let app = launch(["-searchQuery", "özlem"])
        app.tabBars.buttons["Kelimeler"].tap()
        shot("06-sozluk-arama")
    }

    func test04_Hikayeler() {
        let app = launch()
        app.tabBars.buttons["Kelimeler"].tap()
        app.segmentedControls.buttons.element(boundBy: 1).tap()
        shot("07-hikayeler")
    }

    func test05_Hatirla() {
        let app = launch()
        app.tabBars.buttons["Hatırla"].tap()
        shot("08-hatirla")
        app.buttons.matching(identifier: "quiz.option").element(boundBy: 0).tap()
        shot("09-hatirla-cevap")
    }

    func test06_Hediye() {
        let app = launch()
        app.tabBars.buttons["2 Ay Hediye"].tap()
        shot("10-hediye")
    }

    func test07_Klavye() {
        for (i, text) in ["Seni çok özledim ", "lagom bir hayat istiyorum ", "bugün çok yoruldum, "].enumerated() {
            let app = launch(["-tryText", text])
            app.buttons["İlham klavyesi"].firstMatch.tap()
            let field = app.textViews["keyboard.try"].exists ? app.textViews["keyboard.try"] : app.textFields["keyboard.try"]
            if field.waitForExistence(timeout: 5) {
                field.swipeUp() // listeyi kaydırıp alanı görünür yap
                field.tap()
            }
            shot("1\(1 + i)-klavye-\(i + 1)", wait: 2.5)
            app.terminate()
        }
    }

    func test08_Ayarlar() {
        let app = launch()
        app.buttons["Ayarlar"].firstMatch.tap()
        shot("14-ayarlar")
    }

    func test09_WidgettenSozluk() {
        let app = launch()
        // Widget'a dokununca açılan bağlantının aynısı:
        app.open(URL(string: "bunedir://dict/ikigai")!)
        shot("15-widgettan-sozluk", wait: 2)
    }
}
