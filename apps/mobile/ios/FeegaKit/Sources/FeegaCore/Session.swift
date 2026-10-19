import Foundation

public struct Session: Equatable, Sendable {
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: Int
    public let raw: Data

    private struct Fields: Decodable {
        let access_token: String
        let refresh_token: String
        let expires_at: Int?
        let expires_in: Int?
    }

    public init(raw: Data) throws {
        let fields = try JSONDecoder().decode(Fields.self, from: raw)
        accessToken = fields.access_token
        refreshToken = fields.refresh_token
        expiresAt = fields.expires_at ?? Int(Date().timeIntervalSince1970) + (fields.expires_in ?? 0)
        self.raw = raw
    }

    public func expires(within seconds: Int, now: Date = Date()) -> Bool {
        expiresAt - Int(now.timeIntervalSince1970) < seconds
    }
}

public enum SessionCookie {
    public static let chunkSize = 3180
    private static let prefix = "base64-"

    public static func name(projectRef: String) -> String {
        "sb-\(projectRef)-auth-token"
    }

    public static func cookies(for session: Session, projectRef: String) -> [(name: String, value: String)] {
        let value = prefix + base64url(session.raw)
        let key = name(projectRef: projectRef)
        if value.count <= chunkSize {
            return [(key, value)]
        }

        var chunks: [(name: String, value: String)] = []
        var rest = Substring(value)
        while !rest.isEmpty {
            chunks.append(("\(key).\(chunks.count)", String(rest.prefix(chunkSize))))
            rest = rest.dropFirst(chunkSize)
        }
        return chunks
    }

    public static func session(from jar: [String: String], projectRef: String) -> Session? {
        let key = name(projectRef: projectRef)
        let value = jar[key] ?? joinedChunks(jar, key: key)
        guard let value, value.hasPrefix(prefix), let raw = fromBase64url(String(value.dropFirst(prefix.count))) else {
            return nil
        }
        return try? Session(raw: raw)
    }

    private static func joinedChunks(_ jar: [String: String], key: String) -> String? {
        var parts: [String] = []
        while let part = jar["\(key).\(parts.count)"] {
            parts.append(part)
        }
        return parts.isEmpty ? nil : parts.joined()
    }

    private static func base64url(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func fromBase64url(_ text: String) -> Data? {
        var base64 = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)
        return Data(base64Encoded: base64)
    }
}
