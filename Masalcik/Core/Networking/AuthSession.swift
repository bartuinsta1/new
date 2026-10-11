import Foundation
import Security

/// Cihaza bağlı anonim hesap (§5.2): ilk açılışta Supabase'de anonim kullanıcı oluşur, jetonlar Anahtar
/// Zinciri'nde saklanır ve süresi dolunca yenilenir. Apple ile Giriş isteğe bağlı olarak sonra bağlanır (Adım 9).
/// Ad, e-posta vb. hiçbir kişisel veri gönderilmez.
actor AuthSession {
    struct Tokens: Codable, Equatable {
        var accessToken: String
        var refreshToken: String
        var expiresAt: Date
        var userId: String
    }

    private let baseURL: URL
    private let anonKey: String
    private let session: URLSession
    private let store: TokenStore
    private var cached: Tokens?
    private var inFlight: Task<Tokens?, Never>?

    init(baseURL: URL, anonKey: String, session: URLSession = .shared, store: TokenStore = KeychainTokenStore()) {
        self.baseURL = baseURL
        self.anonKey = anonKey
        self.session = session
        self.store = store
    }

    /// Geçerli erişim jetonu; gerekirse yeniler ya da anonim hesap açar. Ağ yoksa nil (çağıran yerel yedeğe düşer).
    func accessToken(now: Date = .now) async -> String? {
        if cached == nil { cached = store.load() }
        if let t = cached, t.expiresAt.timeIntervalSince(now) > 60 { return t.accessToken }
        // Aynı anda gelen istekler tek yenileme/kayıt paylaşsın.
        if let inFlight { return await inFlight.value?.accessToken }
        let refreshToken = cached?.refreshToken
        let task = Task { [weak self] () -> Tokens? in
            guard let self else { return nil }
            if let refreshToken, let t = await self.request(path: "token?grant_type=refresh_token", body: ["refresh_token": refreshToken]) {
                return t
            }
            return await self.request(path: "signup", body: [:])     // anonim kayıt
        }
        inFlight = task
        let tokens = await task.value
        inFlight = nil
        if let tokens {
            cached = tokens
            store.save(tokens)
        }
        return tokens?.accessToken
    }

    /// Hesap silindiğinde (§6): jetonları cihazdan da sil.
    func signOut() {
        cached = nil
        store.clear()
    }

    private struct Response: Decodable {
        var accessToken: String
        var refreshToken: String
        var expiresIn: Double
        var user: User
        struct User: Decodable { var id: String }
    }

    private func request(path: String, body: [String: String]) async -> Tokens? {
        // "token?grant_type=…" sorgu dizesi bozulmasın diye dize olarak birleştir.
        let base = baseURL.absoluteString.hasSuffix("/") ? String(baseURL.absoluteString.dropLast()) : baseURL.absoluteString
        guard let url = URL(string: "\(base)/auth/v1/\(path)") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.httpBody = try? JSONEncoder().encode(body)
        guard let (data, response) = try? await session.data(for: req),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let r = try? APICoding.decoder.decode(Response.self, from: data) else { return nil }
        return Tokens(accessToken: r.accessToken, refreshToken: r.refreshToken,
                      expiresAt: .now.addingTimeInterval(r.expiresIn), userId: r.user.id)
    }
}

protocol TokenStore: Sendable {
    func load() -> AuthSession.Tokens?
    func save(_ tokens: AuthSession.Tokens)
    func clear()
}

/// Anahtar Zinciri: yalnızca bu cihazda, kilit açıldıktan sonra erişilebilir; iCloud'a eşitlenmez.
struct KeychainTokenStore: TokenStore {
    private let account = "masalcik.auth"

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: account]
    }

    func load() -> AuthSession.Tokens? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return try? JSONDecoder().decode(AuthSession.Tokens.self, from: data)
    }

    func save(_ tokens: AuthSession.Tokens) {
        guard let data = try? JSONEncoder().encode(tokens) else { return }
        SecItemDelete(query as CFDictionary)
        var q = query
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(q as CFDictionary, nil)
    }

    func clear() { SecItemDelete(query as CFDictionary) }
}

/// Testler için bellek içi depo.
final class MemoryTokenStore: TokenStore, @unchecked Sendable {
    private var tokens: AuthSession.Tokens?
    private let lock = NSLock()
    func load() -> AuthSession.Tokens? { lock.withLock { tokens } }
    func save(_ t: AuthSession.Tokens) { lock.withLock { tokens = t } }
    func clear() { lock.withLock { tokens = nil } }
}
