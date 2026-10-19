import Foundation
import FeegaCore

private let REFRESH_MARGIN_S = 60

@MainActor
public final class SessionStore: ObservableObject {
    @Published public private(set) var session: Session?
    public let config: AppConfig
    public let cache: ListCache
    private let auth: AuthClient

    public init(config: AppConfig) {
        self.config = config
        auth = AuthClient(supabaseURL: config.supabaseURL, anonKey: config.anonKey)
        cache = ListCache(directory: FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("lists"))
        session = Keychain.load().flatMap { try? Session(raw: $0) }
    }

    public lazy var api = ApiClient(base: config.apiBase, tokens: TokenBridge(store: self))

    public func signIn(email: String, password: String) async throws {
        adopt(try await auth.signIn(email: email, password: password))
    }

    public func signOut() {
        Keychain.delete()
        cache.clear()
        session = nil
    }

    public func adopt(_ fresh: Session) {
        Keychain.save(fresh.raw)
        session = fresh
    }

    func validToken() async throws -> String {
        guard let session else {
            throw ApiError.unauthorized
        }
        guard session.expires(within: REFRESH_MARGIN_S) else {
            return session.accessToken
        }
        return try await refreshedToken()
    }

    func refreshedToken() async throws -> String {
        guard let session else {
            throw ApiError.unauthorized
        }
        do {
            let fresh = try await auth.refresh(refreshToken: session.refreshToken)
            adopt(fresh)
            return fresh.accessToken
        } catch AuthError.rejected {
            signOut()
            throw ApiError.unauthorized
        }
    }
}

final class TokenBridge: TokenSource, @unchecked Sendable {
    private weak var store: SessionStore?

    init(store: SessionStore) {
        self.store = store
    }

    func accessToken() async throws -> String {
        guard let store else {
            throw ApiError.unauthorized
        }
        return try await store.validToken()
    }

    func refreshedToken() async throws -> String {
        guard let store else {
            throw ApiError.unauthorized
        }
        return try await store.refreshedToken()
    }
}
