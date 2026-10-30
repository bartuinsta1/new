import XCTest

/// Xcode 15+ otomatik erişilebilirlik denetimi (kontrast, dokunma alanı, etiket, Dynamic Type, kırpılan metin).
final class AccessibilityUITests: MasalcikUITestCase {
    /// - Parameter fixedTypeAllowed: çocuk ekranlarındaki iri düğme yazıları ve ebeveyn kapısı tuş takımı bilerek
    ///   sabit boyuttadır (`masalFont(scales: false)`: 64–96 pt dokunma alanına sığsın, düzen bozulmasın).
    ///   Bu ekranlarda yalnızca `.dynamicType` bulgusu yok sayılır; ebeveyn ekranları (Paywall) tam denetlenir.
    private func audit(fixedTypeAllowed: Bool = false, scaledMap: Bool = false) throws {
        var findings: [String] = []
        try app.performAccessibilityAudit(for: .all) { issue in
            if fixedTypeAllowed && issue.auditType == .dynamicType { return true }
            // Harita `scaleEffect` ile yakınlaştırılır; denetim bölge adlarını ölçeksiz yazı boyutuyla ölçüp
            // "kırpık" sayar (adlar VoiceOver'dan gizli, bölge düğmesi okur). Yalnızca harita testinde yok sayılır.
            if scaledMap && issue.auditType == .textClipped { return true }
            // Bulguyu öğe bilgisiyle raporla: hangi düğme/metin olduğu CI özetinde görünsün.
            let el = issue.element
            findings.append("\(issue.compactDescription) — id: \(el?.identifier ?? "-"), label: \(el?.label ?? "-"), "
                            + "type: \(el.map { String(describing: $0.elementType.rawValue) } ?? "-"), frame: \(el?.frame ?? .zero)")
            return true
        }
        for finding in findings { XCTFail(finding) }
    }

    func testHaritaDenetimi() throws {
        launch()
        XCTAssertTrue(app.buttons["map.parentZone"].waitForExistence(timeout: 10))
        try audit(fixedTypeAllowed: true, scaledMap: true)
    }

    func testEbeveynKapisiDenetimi() throws {
        launch()
        app.buttons["map.parentZone"].tap()
        XCTAssertTrue(app.buttons["gate.key.1"].waitForExistence(timeout: 3))
        try audit(fixedTypeAllowed: true)
    }

    func testPaywallDenetimi() throws {
        launch()
        openParentZone()
        app.tabBars.buttons["Hesap"].tap()
        app.buttons["account.showPaywall"].tap()
        XCTAssertTrue(app.buttons["paywall.purchase"].waitForExistence(timeout: 3))
        try audit()
    }

    func testOnboardingDenetimi() throws {
        launch(state: "onboarding")
        XCTAssertTrue(app.buttons["onboarding.primary"].waitForExistence(timeout: 10))
        try audit(fixedTypeAllowed: true)
    }
}
