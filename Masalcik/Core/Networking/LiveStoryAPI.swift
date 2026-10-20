import Foundation

/// Gerçek backend istemcisi: Supabase Edge Functions + anonim oturum jetonu (AuthSession).
/// API anahtarları (LLM, TTS) asla istemcide durmaz; burada yalnızca kullanıcı oturum jetonu gider.
struct LiveStoryAPI: StoryAPI {
    var baseURL: URL = AppConfig.apiBaseURL
    var anonKey: String = AppConfig.supabaseAnonKey
    var session: URLSession = .shared
    var accessToken: @Sendable () async -> String? = { nil }
    var language: AppLanguage = .current

    func generateStory(_ request: StoryRequest, idempotencyKey: String) -> AsyncThrowingStream<StoryStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var req = try await makeRequest("stories", method: "POST")
                    req.httpBody = try APICoding.encoder.encode(request)
                    req.setValue("application/x-ndjson", forHTTPHeaderField: "Accept")
                    req.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
                    // Üretim + güvenlik denetimi ~10–20 sn sürebilir; sunucu her 3 sn'de "progress" gönderir.
                    req.timeoutInterval = 90
                    let (bytes, response) = try await session.bytes(for: req)
                    try Self.check(response)
                    for try await line in bytes.lines where !line.isEmpty {
                        let parsed = try APICoding.decoder.decode(StreamLine.self, from: Data(line.utf8))
                        continuation.yield(try parsed.toEvent())
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func story(id: String) async throws -> StoryDTO {
        try await get("stories/\(id)")
    }

    func library() async throws -> [LibraryItemDTO] {
        try await get("library")
    }

    func libraryStory(id: String) async throws -> StoryDTO {
        try await get("library/\(id)")
    }

    func createVoiceClone(sample: Data, consentedAt: Date) async throws -> VoiceCloneResponseDTO {
        var req = try await makeRequest("voice-clone", method: "POST")
        req.setValue("audio/m4a", forHTTPHeaderField: "Content-Type")
        req.setValue(ISO8601DateFormatter().string(from: consentedAt), forHTTPHeaderField: "X-Consent-At")
        req.httpBody = sample
        let (data, response) = try await session.data(for: req)
        try Self.check(response)
        return try APICoding.decoder.decode(VoiceCloneResponseDTO.self, from: data)
    }

    func deleteVoiceClone() async throws {
        let (_, response) = try await session.data(for: try await makeRequest("voice-clone", method: "DELETE"))
        try Self.check(response)
    }

    func verifyEntitlement(signedTransaction: String?) async throws -> EntitlementDTO {
        var req = try await makeRequest("entitlements/verify", method: "POST")
        req.httpBody = try APICoding.encoder.encode(["signed_transaction": signedTransaction])
        let (data, response) = try await session.data(for: req)
        try Self.check(response)
        return try APICoding.decoder.decode(EntitlementDTO.self, from: data)
    }

    func restoreEntitlements(signedTransactions: [String]) async throws -> EntitlementDTO {
        var req = try await makeRequest("entitlements/verify", method: "POST")
        req.httpBody = try APICoding.encoder.encode(["signed_transactions": signedTransactions])
        let (data, response) = try await session.data(for: req)
        try Self.check(response)
        return try APICoding.decoder.decode(EntitlementDTO.self, from: data)
    }

    func referral() async throws -> ReferralDTO { try await get("referral") }

    func sendEvents(_ events: [AnalyticsEventDTO]) async throws {
        var req = try await makeRequest("events", method: "POST")
        req.httpBody = try JSONEncoder().encode(["events": events])
        let (_, response) = try await session.data(for: req)
        try Self.check(response)
    }

    func redeemReferral(code: String) async throws -> ReferralRedeemDTO {
        var req = try await makeRequest("referral/redeem", method: "POST")
        req.httpBody = try APICoding.encoder.encode(["code": code])
        let (data, response) = try await session.data(for: req)
        try Self.check(response)
        return try APICoding.decoder.decode(ReferralRedeemDTO.self, from: data)
    }

    func shareStory(id: String) async throws -> URL {
        var req = try await makeRequest("share", method: "POST")
        req.httpBody = try APICoding.encoder.encode(["story_id": id])
        let (data, response) = try await session.data(for: req)
        try Self.check(response)
        return try APICoding.decoder.decode(ShareResponseDTO.self, from: data).url
    }

    func deleteAccount() async throws {
        let (_, response) = try await session.data(for: try await makeRequest("account", method: "DELETE"))
        try Self.check(response)
    }

    // MARK: - Yardımcılar

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let (data, response) = try await session.data(for: try await makeRequest(path, method: "GET"))
        try Self.check(response)
        do { return try APICoding.decoder.decode(T.self, from: data) } catch { throw APIError.decoding }
    }

    private func makeRequest(_ path: String, method: String) async throws -> URLRequest {
        var req = URLRequest(url: baseURL.appending(path: path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Kütüphane başlıkları ve hata metinleri bu dilde döner.
        req.setValue(language.rawValue, forHTTPHeaderField: "Accept-Language")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        // Jeton alınamazsa (ağ yok) istek yine gider; sunucu 401 döner, uygulama yerel yedeğe düşer.
        if let token = await accessToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    static func check(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw APIError.offline }
        switch http.statusCode {
        case 200..<300: return
        // Ayrıntılı kod (unsafe_input vb.) gövdededir; akışlı istekte gövde okunmadan önce kontrol edilir.
        case 400 where http.value(forHTTPHeaderField: "X-Error-Code") == "unsafe_input": throw APIError.unsafeInput
        case 401: throw APIError.unauthorized
        case 402 where http.value(forHTTPHeaderField: "X-Error-Code") == "premium_required": throw APIError.premiumRequired
        case 402: throw APIError.dailyLimitReached
        case 403 where http.value(forHTTPHeaderField: "X-Error-Code") == "weekly_limit_reached":
            throw APIError.weeklyLimitReached
        case 400, 404, 409:
            if let code = http.value(forHTTPHeaderField: "X-Error-Code"),
               ["invalid_code", "own_code", "already_redeemed"].contains(code) {
                throw APIError.referralRejected(code)
            }
            throw APIError.server(status: http.statusCode)
        case 429: throw APIError.rateLimited
        default: throw APIError.server(status: http.statusCode)
        }
    }
}
