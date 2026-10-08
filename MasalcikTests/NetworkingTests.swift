import Testing
import Foundation
@testable import Masalcik

@Suite("Ağ sözleşmesi ve sahte backend")
struct NetworkingTests {
    @Test func istekSnakeCaseKodlanir() throws {
        let data = try APICoding.encoder.encode(MockStoryAPI.previewRequest)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(json["child_name"] as? String == "Ayşe")
        #expect(json["companion_character"] as? String == "findik")
        #expect(json["region"] as? String == "whisper_forest")
        #expect(json["duration_minutes"] as? Int == 5)
        let filters = try #require(json["content_filters"] as? [String: Any])
        #expect(filters["allow_loss_and_separation"] as? Bool == false)
    }

    @Test func akisSatirlariCozulur() throws {
        let line = #"{"type":"paragraph","paragraph":{"index":0,"text":"Bir varmış bir yokmuş…","scene_hint":"forest","emotion":"whisper","audio_url":"https://cdn.example.com/a.mp3"}}"#
        let parsed = try APICoding.decoder.decode(StreamLine.self, from: Data(line.utf8))
        guard case .paragraph(let p) = try parsed.toEvent() else { Issue.record("paragraf bekleniyordu"); return }
        #expect(p.emotion == .whisper)
        #expect(p.audioUrl?.absoluteString == "https://cdn.example.com/a.mp3")
    }

    @Test func limitHatasiAyirtEdilir() throws {
        let line = #"{"type":"error","code":"daily_limit_reached"}"#
        let parsed = try APICoding.decoder.decode(StreamLine.self, from: Data(line.utf8))
        #expect(throws: APIError.dailyLimitReached) { try parsed.toEvent() }
    }

    @Test func sahteAkisSirasi() async throws {
        let api = MockStoryAPI(paragraphDelay: .zero)
        var events: [StoryStreamEvent] = []
        for try await e in api.generateStory(MockStoryAPI.previewRequest) { events.append(e) }
        guard case .started = events.first else { Issue.record("ilk olay started olmalı"); return }
        guard case .completed(let story) = events.last else { Issue.record("son olay completed olmalı"); return }
        #expect(events.count == story.paragraphs.count + 2)

        let first = try #require(story.paragraphs.first?.text)
        let last = try #require(story.paragraphs.last?.text)
        #expect(first.hasPrefix("Bir varmış bir yokmuş"))
        #expect(first.contains("Fısıltı Ormanı'nda"))
        #expect(last.hasPrefix("Gökten üç elma düşmüş"))
        #expect(last.contains("Ayşe'ye") && last.contains("Fındık'a"))
        let nameCount = story.paragraphs.map(\.text).joined(separator: " ").components(separatedBy: "Ayşe").count - 1
        #expect((3...5).contains(nameCount))   // §4.3: ad 3–5 kez geçer
    }
}
