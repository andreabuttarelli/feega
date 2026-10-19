import Foundation
@testable import FeegaCore

final class FakeTransport: Transport, @unchecked Sendable {
    var answers: [(Int, String)]
    private(set) var sent: [URLRequest] = []

    init(_ answers: [(Int, String)]) {
        self.answers = answers
    }

    func send(_ request: URLRequest) async throws -> (Data, Int) {
        sent.append(request)
        let (status, body) = answers.removeFirst()
        return (Data(body.utf8), status)
    }
}

let GOTRUE_SESSION = """
{"access_token":"at1","token_type":"bearer","expires_in":3600,"expires_at":1900000000,"refresh_token":"rt1","user":{"id":"u1","email":"t@x.it"}}
"""
