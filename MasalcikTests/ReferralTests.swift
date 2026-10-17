import Testing
import Foundation
@testable import Masalcik

@Suite("Davet kodu")
struct ReferralTests {
    @Test func normalizeSunucuIleAyni() {
        #expect(ReferralSection.normalized(" pmk-7qx ") == "PMK7QX")
        // Türkçe klavye: "i" büyük harfte "I" olur, "İ" değil (sunucu da en-US büyütür).
        #expect(ReferralSection.normalized("abcdi2") == "ABCDI2")
        #expect(ReferralSection.normalized("kısa") == nil)
        #expect(ReferralSection.normalized("ÇOCUK1") == nil)
    }

    @Test func hataKodlariEslenir() {
        let r = HTTPURLResponse(url: URL(string: "https://x")!, statusCode: 409, httpVersion: nil,
                                headerFields: ["X-Error-Code": "already_redeemed"])!
        #expect(throws: APIError.referralRejected("already_redeemed")) { try LiveStoryAPI.check(r) }
    }

    @Test func davetMesajindaKodVar() {
        #expect(ReferralSection.inviteMessage(code: "PMK7QX").contains("PMK7QX"))
    }
}
