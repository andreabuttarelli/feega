import Foundation

public protocol TokenSource: AnyObject, Sendable {
    func accessToken() async throws -> String
    func refreshedToken() async throws -> String
}

public enum ApiError: Error, Equatable {
    case unauthorized
    case refused(Int, String)
}

private enum Attempt {
    case first
    case afterRefresh
}

public final class ApiClient: Sendable {
    private let base: URL
    private let transport: Transport
    private let tokens: TokenSource

    public init(base: URL, transport: Transport = URLSessionTransport(), tokens: TokenSource) {
        self.base = base
        self.transport = transport
        self.tokens = tokens
    }

    public func projects(org: String?) async throws -> ProjectList {
        var parts = URLComponents(url: base.appendingPathComponent("api/v1/me/projects"), resolvingAgainstBaseURL: false)!
        if let org {
            parts.queryItems = [URLQueryItem(name: "org", value: org)]
        }
        return try await get(parts.url!)
    }

    public func canvases(projectId: String) async throws -> CanvasList {
        try await get(base.appendingPathComponent("api/v1/projects/\(projectId)/canvases"))
    }

    private struct Refusal: Decodable {
        let error: String?
    }

    private func get<T: Decodable>(_ url: URL, attempt: Attempt = .first) async throws -> T {
        let token = attempt == .first ? try await tokens.accessToken() : try await tokens.refreshedToken()
        let (data, status) = try await transport.send(jsonRequest(url, headers: ["Authorization": "Bearer \(token)"]))

        if status == 401 {
            guard attempt == .first else {
                throw ApiError.unauthorized
            }
            return try await get(url, attempt: .afterRefresh)
        }
        guard (200..<300).contains(status) else {
            throw ApiError.refused(status, (try? JSONDecoder().decode(Refusal.self, from: data))?.error ?? "")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
