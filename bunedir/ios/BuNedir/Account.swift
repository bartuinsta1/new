import Foundation
import Security

/// Supabase ayarları Info.plist'ten (Config.xcconfig) gelir. Boşsa hediye ekranı "yakında" der.
enum AppConfig {
    static let supabaseURL = (Bundle.main.object(forInfoDictionaryKey: "BuNedirSupabaseURL") as? String).flatMap { $0.isEmpty ? nil : URL(string: $0) }
    static let supabaseAnonKey = Bundle.main.object(forInfoDictionaryKey: "BuNedirSupabaseAnonKey") as? String ?? ""
    static var accountEnabled: Bool { supabaseURL != nil && !supabaseAnonKey.isEmpty }
    static let trialDays = 60
}

struct TrialCode: Codable, Equatable {
    let code: String
    let trialDays: Int
    let redeemed: Bool
}

enum AccountError: LocalizedError {
    case notConfigured, invalidEmail, invalidOTP, network, server(String)
    var errorDescription: String? {
        switch self {
        case .notConfigured: "Kayıt şu an kapalı. Lütfen daha sonra tekrar dene."
        case .invalidEmail: "Geçerli bir e-posta adresi yaz."
        case .invalidOTP: "Kod hatalı ya da süresi dolmuş. Yeni kod iste."
        case .network: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene."
        case .server(let m): "Bir şeyler ters gitti (\(m)). Biraz sonra tekrar dene."
        }
    }
}

/// E-posta + 6 haneli kod (Supabase Auth OTP) ile kayıt; parola yok, üçüncü taraf SDK yok.
@MainActor
final class Account: ObservableObject {
    @Published private(set) var email: String? = UserDefaults.standard.string(forKey: "account.email")
    @Published private(set) var trial: TrialCode? = Account.storedTrial()
    @Published var busy = false

    var isSignedIn: Bool { Keychain.get("refresh_token") != nil }

    private let session: URLSession
    init(session: URLSession = .shared) { self.session = session }

    func sendCode(to rawEmail: String) async throws {
        let email = rawEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard email.range(of: #"^[^@\s]+@[^@\s]+\.[^@\s]+$"#, options: .regularExpression) != nil else { throw AccountError.invalidEmail }
        _ = try await auth("otp", body: ["email": email, "create_user": true])
        UserDefaults.standard.set(email, forKey: "account.email")
        self.email = email
    }

    func verify(code: String) async throws {
        guard let email else { throw AccountError.invalidEmail }
        let digits = code.filter(\.isNumber)
        do {
            let tokens = try await auth("verify", body: ["type": "email", "email": email, "token": digits])
            try store(tokens)
        } catch AccountError.server {
            throw AccountError.invalidOTP
        }
        try await refreshTrial()
    }

    func refreshTrial() async throws {
        let data = try await function(method: "GET")
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        guard let code = obj["code"] as? String else { throw AccountError.server("kod yok") }
        let t = TrialCode(code: code, trialDays: obj["trial_days"] as? Int ?? AppConfig.trialDays, redeemed: obj["redeemed"] as? Bool ?? false)
        trial = t
        UserDefaults.standard.set(try JSONEncoder().encode(t), forKey: "account.trial")
    }

    /// App Store 5.1.1(v): uygulama içinden hesap silme. Sunucuda kullanıcı + kod silinir.
    func deleteAccount() async throws {
        _ = try await function(method: "DELETE")
        signOutLocally()
    }

    func signOutLocally() {
        Keychain.delete("access_token"); Keychain.delete("refresh_token")
        UserDefaults.standard.removeObject(forKey: "account.email")
        UserDefaults.standard.removeObject(forKey: "account.trial")
        email = nil; trial = nil
    }

    // MARK: - Ağ

    private static func storedTrial() -> TrialCode? {
        UserDefaults.standard.data(forKey: "account.trial").flatMap { try? JSONDecoder().decode(TrialCode.self, from: $0) }
    }

    private func store(_ tokens: [String: Any]) throws {
        guard let access = tokens["access_token"] as? String, let refresh = tokens["refresh_token"] as? String else {
            throw AccountError.server("token yok")
        }
        Keychain.set(access, for: "access_token")
        Keychain.set(refresh, for: "refresh_token")
    }

    private func auth(_ path: String, query: String = "", body: [String: Any]) async throws -> [String: Any] {
        guard let base = AppConfig.supabaseURL else { throw AccountError.notConfigured }
        var req = URLRequest(url: URL(string: "auth/v1/\(path)\(query)", relativeTo: base)!)
        req.httpMethod = "POST"
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, status) = try await send(req)
        guard (200..<300).contains(status) else { throw AccountError.server("auth \(status)") }
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    private func function(method: String, retry: Bool = true) async throws -> Data {
        guard let base = AppConfig.supabaseURL else { throw AccountError.notConfigured }
        guard let token = Keychain.get("access_token") else { throw AccountError.server("giriş yok") }
        var req = URLRequest(url: URL(string: "functions/v1/bunedir-trial", relativeTo: base)!)
        req.httpMethod = method
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        let (data, status) = try await send(req)
        if status == 401, retry, let refresh = Keychain.get("refresh_token") {
            // Erişim jetonu 1 saatte dolar; yenileyip bir kez daha dene.
            try store(try await auth("token", query: "?grant_type=refresh_token", body: ["refresh_token": refresh]))
            return try await function(method: method, retry: false)
        }
        guard (200..<300).contains(status) else { throw AccountError.server("\(status)") }
        return data
    }

    private func send(_ req: URLRequest) async throws -> (Data, Int) {
        do {
            let (data, res) = try await session.data(for: req)
            return (data, (res as? HTTPURLResponse)?.statusCode ?? 0)
        } catch {
            throw AccountError.network
        }
    }
}

enum Keychain {
    private static func query(_ key: String) -> [CFString: Any] {
        [kSecClass: kSecClassGenericPassword, kSecAttrService: "bunedir.account", kSecAttrAccount: key]
    }
    static func set(_ value: String, for key: String) {
        SecItemDelete(query(key) as CFDictionary)
        var q = query(key)
        q[kSecValueData] = Data(value.utf8)
        q[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(q as CFDictionary, nil)
    }
    static func get(_ key: String) -> String? {
        var q = query(key)
        q[kSecReturnData] = true
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
    static func delete(_ key: String) { SecItemDelete(query(key) as CFDictionary) }
}
