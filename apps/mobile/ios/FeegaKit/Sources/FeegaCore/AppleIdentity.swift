import Foundation

public struct AppleIdentity: Equatable {
    public let payload: [String: String]

    public init?(token: Data?, code: Data?, givenName: String?, familyName: String?) {
        guard let identityToken = token.flatMap({ String(data: $0, encoding: .utf8) }) else {
            return nil
        }
        payload = [
            "identityToken": identityToken,
            "authorizationCode": code.flatMap { String(data: $0, encoding: .utf8) } ?? "",
            "fullName": [givenName, familyName].compactMap { $0 }.joined(separator: " ")
        ]
    }
}
