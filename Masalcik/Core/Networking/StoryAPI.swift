import Foundation

/// Backend uç noktalarının soyutlaması (§5.2). Testlerde ve Preview'larda `MockStoryAPI` kullanılır.
protocol StoryAPI: Sendable {
    /// `POST /stories` — akışlı masal üretimi. Aynı `idempotencyKey` ile tekrar (ör. ağ kopması sonrası)
    /// sunucu masalı yeniden üretmez ve günlük kotayı ikinci kez düşmez.
    func generateStory(_ request: StoryRequest, idempotencyKey: String) -> AsyncThrowingStream<StoryStreamEvent, Error>
    /// `GET /stories/:id`
    func story(id: String) async throws -> StoryDTO
    /// `GET /library`
    func library() async throws -> [LibraryItemDTO]
    /// `POST /voice-clone` — ses örneği (m4a) yükler. Ayrı rıza alınmadan çağrılmamalı.
    func createVoiceClone(sample: Data, consentedAt: Date) async throws -> VoiceCloneResponseDTO
    /// `DELETE /voice-clone`
    func deleteVoiceClone() async throws
    /// `POST /entitlements/verify` — StoreKit 2 JWS işlemini sunucuda doğrular.
    func verifyEntitlement(signedTransaction: String?) async throws -> EntitlementDTO
    /// `DELETE /account` — tüm verileri siler.
    func deleteAccount() async throws
}

extension StoryAPI {
    func generateStory(_ request: StoryRequest) -> AsyncThrowingStream<StoryStreamEvent, Error> {
        generateStory(request, idempotencyKey: UUID().uuidString)
    }
}

enum APICoding {
    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

/// NDJSON akış satırı. Backend `{"type":"paragraph","paragraph":{…}}` biçiminde gönderir.
struct StreamLine: Decodable {
    enum Kind: String, Decodable { case started, paragraph, completed, error }
    var type: Kind
    var id: String?
    var title: String?
    var coverScene: CoverSceneDTO?
    var paragraph: ParagraphDTO?
    var story: StoryDTO?
    var code: String?
    var stage: String?

    func toEvent() throws -> StoryStreamEvent {
        switch type {
        case .progress:
            return .progress(stage: stage ?? "writing")
        case .started:
            guard let id, let title, let coverScene else { throw APIError.decoding }
            return .started(id: id, title: title, coverScene: coverScene)
        case .paragraph:
            guard let paragraph else { throw APIError.decoding }
            return .paragraph(paragraph)
        case .completed:
            guard let story else { throw APIError.decoding }
            return .completed(story)
        case .error:
            if code == "daily_limit_reached" { throw APIError.dailyLimitReached }
            if code == "rate_limited" { throw APIError.rateLimited }
            if code == "unsafe_input" { throw APIError.unsafeInput }
            throw APIError.server(status: 500)
        }
    }
}
