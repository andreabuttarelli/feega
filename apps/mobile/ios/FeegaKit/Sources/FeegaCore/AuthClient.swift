import Foundation

public enum AuthError: Error, Equatable {
    case rejected(String)
}

public struct AuthClient: Sendable {
    private let supabaseURL: URL
    private let anonKey: String
    private let transport: Transport

    public init(supabaseURL: URL, anonKey: String, transport: Transport = URLSessionTransport()) {
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
        self.transport = transport
    }

    public func signIn(email: String, password: String) async throws -> Session {
        try await grant("password", ["email": email, "password": password])
    }

    public func signInWithApple(idToken: String, nonce: String) async throws -> Session {
        try await grant("id_token", ["provider": "apple", "id_token": idToken, "nonce": nonce])
    }

    public func refresh(refreshToken: String) async throws -> Session {
        try await grant("refresh_token", ["refresh_token": refreshToken])
    }

    private struct Refusal: Decodable {
        let error_description: String?
        let msg: String?
        let error: String?
    }

    private func grant(_ type: String, _ body: [String: String]) async throws -> Session {
        let url = URL(string: "auth/v1/token?grant_type=\(type)", relativeTo: supabaseURL)!.absoluteURL
        let request = jsonRequest(url, method: "POST", body: body, headers: ["apikey": anonKey])
        let (data, status) = try await transport.send(request)
        guard (200..<300).contains(status) else {
            let refusal = try? JSONDecoder().decode(Refusal.self, from: data)
            throw AuthError.rejected(refusal?.error_description ?? refusal?.msg ?? refusal?.error ?? "HTTP \(status)")
        }
        return try Session(raw: data)
    }
}
