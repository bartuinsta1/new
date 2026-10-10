import Testing
import Foundation
@testable import Masalcik

@Suite("Ağ sözleşmesi ve sahte backend")
struct NetworkingTests {
    @Test func istekSnakeCaseKodlanir() throws {
        let data = try APICoding.encoder.encode(MockStoryAPI.previewRequest(language: .tr))
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(json["child_name"] as? String == "Ayşe")
        #expect(json["companion_character"] as? String == "findik")
        #expect(json["region"] as? String == "whisper_forest")
        #expect(json["duration_minutes"] as? Int == 5)
        let filters = try #require(json["content_filters"] as? [String: Any])
        #expect(filters["allow_loss_and_separation"] as? Bool == false)
        #expect(json["language"] as? String == "tr")
    }

    @Test func akisSatirlariCozulur() throws {
        let line = #"{"type":"paragraph","paragraph":{"index":0,"text":"Bir varmış bir yokmuş…","scene_hint":"forest","emotion":"whisper","audio_url":"https://cdn.example.com/a.mp3"}}"#
        let parsed = try APICoding.decoder.decode(StreamLine.self, from: Data(line.utf8))
        guard case .paragraph(let p) = try parsed.toEvent() else { Issue.record("paragraf bekleniyordu"); return }
        #expect(p.emotion == .whisper)
        #expect(p.audioUrl?.absoluteString == "https://cdn.example.com/a.mp3")
    }

    @Test func ilerlemeSatiriCozulur() throws {
        let line = #"{"type":"progress","stage":"writing"}"#
        let parsed = try APICoding.decoder.decode(StreamLine.self, from: Data(line.utf8))
        #expect(try parsed.toEvent() == .progress(stage: "writing"))
    }

    @Test func uygunsuzGirdiHatasi() throws {
        let line = #"{"type":"error","code":"unsafe_input"}"#
        let parsed = try APICoding.decoder.decode(StreamLine.self, from: Data(line.utf8))
        #expect(throws: APIError.unsafeInput) { try parsed.toEvent() }
    }

    @Test func limitHatasiAyirtEdilir() throws {
        let line = #"{"type":"error","code":"daily_limit_reached"}"#
        let parsed = try APICoding.decoder.decode(StreamLine.self, from: Data(line.utf8))
        #expect(throws: APIError.dailyLimitReached) { try parsed.toEvent() }
    }

    @Test func sahteAkisSirasi() async throws {
        let api = MockStoryAPI(paragraphDelay: .zero)
        var events: [StoryStreamEvent] = []
        for try await e in api.generateStory(MockStoryAPI.previewRequest(language: .tr)) { events.append(e) }
        guard case .progress = events.first else { Issue.record("ilk olay progress olmalı"); return }
        guard case .started = events[1] else { Issue.record("ikinci olay started olmalı"); return }
        guard case .completed(let story) = events.last else { Issue.record("son olay completed olmalı"); return }
        #expect(events.count == story.paragraphs.count + 3)

        let first = try #require(story.paragraphs.first?.text)
        let last = try #require(story.paragraphs.last?.text)
        #expect(first.hasPrefix("Bir varmış bir yokmuş"))
        #expect(first.contains("Fısıltı Ormanı'nda"))
        #expect(last.hasPrefix("Gökten üç elma düşmüş"))
        #expect(last.contains("Ayşe'ye") && last.contains("Fındık'a"))
        let nameCount = story.paragraphs.map(\.text).joined(separator: " ").components(separatedBy: "Ayşe").count - 1
        #expect((3...5).contains(nameCount))   // §4.3: ad 3–5 kez geçer
    }

    @Test func ingilizceSahteMasal() async throws {
        let story = MockStoryAPI.sampleStory(for: MockStoryAPI.previewRequest(language: .en))
        let first = try #require(story.paragraphs.first?.text)
        let last = try #require(story.paragraphs.last?.text)
        #expect(story.title == "Emma and the Lost Lantern")
        #expect(first.hasPrefix("Once upon a time, in Whisper Forest"))
        #expect(last.hasPrefix("Three apples fell from the sky: one for Emma"))
        // Türkçe ek kalıntısı olmamalı
        #expect(!story.paragraphs.map(\.text).joined().contains("'ye"))
    }

    @Test func kutuphaneHerIkiDilde() {
        let tr = MockStoryAPI.sampleLibrary(.tr), en = MockStoryAPI.sampleLibrary(.en)
        #expect(tr.map(\.id) == en.map(\.id))
        #expect(tr.first?.title != en.first?.title)
        // Her bölgede en fazla 6 masal (haritada balon kart sınırı)
        for region in Region.allCases { #expect(tr.filter { $0.region == region }.count <= 6) }
    }
}
