import Testing
@testable import Masalcik

@Suite("Ebeveyn kapısı")
@MainActor
struct ParentGateTests {
    @Test func soruMetni() {
        let c = ParentGateChallenge(answer: 63, language: .tr)
        #expect(c.prompt == "Altmış üç rakamla yazılırsa hangisi?")
        #expect(ParentGateChallenge(answer: 63, language: .en).prompt == "What is sixty-three written in digits?")
        #expect(c.isCorrect("63"))
        #expect(!c.isCorrect("36"))
    }

    @Test func rastgeleSorularGecerliAralikta() {
        var rng = SplitMix64(seed: 1)
        for _ in 0..<500 {
            let c = ParentGateChallenge.random(using: &rng)
            #expect((21...99).contains(c.answer))
            #expect(c.answer % 10 != 0)
        }
    }

    @Test func dogruYanitKilidiAcar() {
        let model = ParentGateModel(makeChallenge: { ParentGateChallenge(answer: 47) })
        model.type(4)
        #expect(!model.isUnlocked)
        model.type(7)
        #expect(model.isUnlocked)
    }

    @Test func yanlisYanitYeniSoruGetirir() {
        var answers = [52, 38]
        let model = ParentGateModel(makeChallenge: { ParentGateChallenge(answer: answers.removeFirst()) })
        model.type(2); model.type(5)
        #expect(!model.isUnlocked)
        #expect(model.failedAttempts == 1)
        #expect(model.challenge.answer == 38)
        #expect(model.input.isEmpty)
    }

    @Test func silme() {
        let model = ParentGateModel(makeChallenge: { ParentGateChallenge(answer: 81) })
        model.type(8); model.deleteLast(); model.type(8); model.type(1)
        #expect(model.isUnlocked)
    }
}
