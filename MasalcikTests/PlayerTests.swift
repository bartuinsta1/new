import Testing
import Foundation
@testable import Masalcik

@Suite("Masal oynatıcı mantığı")
struct PlayerTests {
    // MARK: Segment planı

    @Test func yerelDosyaOnceUzakSonraCihazSesi() {
        let local = URL(fileURLWithPath: "/tmp/a.mp3"), remote = URL(string: "https://cdn/a.mp3")!
        #expect(SegmentPlanner.segment(text: "t", emotion: .neutral, audioURL: remote, localFile: local, fileExists: { _ in true })
                == .file(local, text: "t"))
        #expect(SegmentPlanner.segment(text: "t", emotion: .neutral, audioURL: remote, localFile: local, fileExists: { _ in false })
                == .remote(remote, text: "t"))
        #expect(SegmentPlanner.segment(text: "t", emotion: .sleepy, audioURL: nil, localFile: nil)
                == .speech(text: "t", emotion: .sleepy))
    }

    // MARK: Uyku zamanlayıcı

    @Test func zamanlayiciSecenekleriDongu() {
        #expect(SleepTimerOption.endOfStory.next == .fifteen)
        #expect(SleepTimerOption.fortyFive.next == .endOfStory)
        let start = Date(timeIntervalSince1970: 0)
        #expect(SleepTimerOption.endOfStory.deadline(from: start) == nil)
        #expect(SleepTimerOption.thirty.deadline(from: start) == start.addingTimeInterval(1800))
    }

    // MARK: İlerleme ve kararma

    @Test func ilerlemeMetinUzunluguylaAgirliklanir() {
        let p = PlaybackProgress(texts: ["aaaa", "aaaa", "aaaaaaaa"])   // 25%, 25%, 50%
        #expect(p.fraction(segmentIndex: 0, segmentFraction: 0) == 0)
        #expect(abs(p.fraction(segmentIndex: 1, segmentFraction: 0.5) - 0.375) < 1e-9)
        #expect(abs(p.fraction(segmentIndex: 2, segmentFraction: 1) - 1) < 1e-9)
        #expect(p.fraction(segmentIndex: 9, segmentFraction: 0) == 1)
        #expect(PlaybackProgress(texts: []).fraction(segmentIndex: 0, segmentFraction: 0.5) == 0)
    }

    @Test func ekranSonYuzdeYirmidedeNeredeyseSiyah() {
        let p = PlaybackProgress(texts: Array(repeating: "paragraf", count: 10))
        #expect(DimmingCurve.dimming(forProgress: p.fraction(segmentIndex: 3, segmentFraction: 0)) == 0)
        let late = DimmingCurve.dimming(forProgress: p.fraction(segmentIndex: 9, segmentFraction: 0.9))
        #expect(late > 0.8)
    }

    // MARK: Karaoke

    @Test func karaokeKelimeSirasi() {
        let text = "Bir varmış bir yokmuş"
        #expect(KaraokeTiming.wordRanges(in: text).count == 4)
        #expect(KaraokeTiming.wordIndex(in: text, fraction: 0) == 0)
        #expect(KaraokeTiming.wordIndex(in: text, fraction: 0.4) == 1)   // 21 harfin %40ı → "varmış"
        #expect(KaraokeTiming.wordIndex(in: text, fraction: 1) == 3)
        #expect(KaraokeTiming.wordIndex(in: "", fraction: 0.5) == nil)
        // Cihaz sentezi UTF-16 konumu bildirir; Türkçe harfler doğru sayılmalı
        #expect(KaraokeTiming.wordIndex(in: "Çiğdem şöyle güldü", utf16Location: 7) == 1)
    }

    // MARK: Ses kısma

    @Test func sesYumusakcaKisilir() {
        #expect(VolumeFade.volume(from: 1, elapsed: 0) == 1)
        #expect(VolumeFade.volume(from: 1, elapsed: VolumeFade.duration) == 0)
        let mid = VolumeFade.volume(from: 1, elapsed: VolumeFade.duration / 2)
        #expect(abs(mid - 0.5) < 0.001)
        // Monoton azalır
        var last: Float = 2
        for s in stride(from: 0.0, through: VolumeFade.duration, by: 1) {
            let v = VolumeFade.volume(from: 1, elapsed: s)
            #expect(v <= last)
            last = v
        }
    }
}

@Suite("Ses motoru")
@MainActor
struct AudioEngineTests {
    @Test func kurulurkenCalmaz() {
        let engine = StoryAudioEngine(language: .tr, goodnightText: "İyi geceler")
        engine.append(.speech(text: "Bir varmış bir yokmuş.", emotion: .neutral))
        #expect(engine.phase == .waitingForAudio)
        engine.stop()
    }

    @Test func zamanlayiciVarsayilaniMasalBitince() {
        let engine = StoryAudioEngine(language: .tr, goodnightText: "İyi geceler")
        #expect(engine.sleepTimer == .endOfStory)
        engine.stop()
    }
}
