import Testing
import Foundation
@testable import Masalcik

/// Ağ isteklerini yakalayıp hazır yanıt döndüren URLProtocol.
final class StubURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) -> (Int, Data))?
    nonisolated(unsafe) static var requests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests.append(request)
        let (status, data) = Self.handler?(request) ?? (500, Data())
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}

    static func session() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: config)
    }
}

@Suite("Anonim hesap", .serialized)
struct AuthSessionTests {
    private let base = URL(string: "https://proj.supabase.co")!
    private func tokenJSON(_ access: String) -> Data {
        Data(#"{"access_token":"\#(access)","refresh_token":"r-\#(access)","expires_in":3600,"token_type":"bearer","user":{"id":"user-1"}}"#.utf8)
    }

    @Test func ilkAcilistaAnonimKayitSonraOnbellek() async {
        StubURLProtocol.requests = []
        StubURLProtocol.handler = { _ in (200, tokenJSON("a1")) }
        let store = MemoryTokenStore()
        let auth = AuthSession(baseURL: base, anonKey: "anon", session: StubURLProtocol.session(), store: store)
        #expect(await auth.accessToken() == "a1")
        #expect(StubURLProtocol.requests.first?.url?.absoluteString == "https://proj.supabase.co/auth/v1/signup")
        #expect(StubURLProtocol.requests.first?.value(forHTTPHeaderField: "apikey") == "anon")
        #expect(await auth.accessToken() == "a1")
        #expect(StubURLProtocol.requests.count == 1)          // ikinci çağrıda ağ yok
        #expect(store.load()?.userId == "user-1")
    }

    @Test func suresiDolanJetonYenilenir() async {
        StubURLProtocol.requests = []
        StubURLProtocol.handler = { _ in (200, tokenJSON("a2")) }
        let store = MemoryTokenStore()
        store.save(.init(accessToken: "old", refreshToken: "r-old", expiresAt: .now.addingTimeInterval(-10), userId: "user-1"))
        let auth = AuthSession(baseURL: base, anonKey: "anon", session: StubURLProtocol.session(), store: store)
        #expect(await auth.accessToken() == "a2")
        #expect(StubURLProtocol.requests.first?.url?.absoluteString == "https://proj.supabase.co/auth/v1/token?grant_type=refresh_token")
    }

    @Test func agYoksaNilDoner() async {
        StubURLProtocol.handler = { _ in (503, Data()) }
        let auth = AuthSession(baseURL: base, anonKey: "anon", session: StubURLProtocol.session(), store: MemoryTokenStore())
        #expect(await auth.accessToken() == nil)
    }

    @Test func cikisJetonlariSiler() async {
        let store = MemoryTokenStore()
        store.save(.init(accessToken: "a", refreshToken: "r", expiresAt: .now.addingTimeInterval(3600), userId: "u"))
        let auth = AuthSession(baseURL: base, anonKey: "anon", session: StubURLProtocol.session(), store: store)
        await auth.signOut()
        #expect(store.load() == nil)
    }
}
