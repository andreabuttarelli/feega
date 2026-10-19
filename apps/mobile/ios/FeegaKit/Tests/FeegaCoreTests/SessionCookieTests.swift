import XCTest
@testable import FeegaCore

final class SessionCookieTests: XCTestCase {
    func testASmallSessionIsOneBase64urlCookieNamedLikeSupabaseSsr() throws {
        let session = try Session(raw: Data(GOTRUE_SESSION.utf8))

        let cookies = SessionCookie.cookies(for: session, projectRef: "ref")

        XCTAssertEqual(cookies.map(\.name), ["sb-ref-auth-token"])
        XCTAssertTrue(cookies[0].value.hasPrefix("base64-"))
        XCTAssertFalse(cookies[0].value.contains("="))
    }

    func testALargeSessionIsChunkedAt3180Characters() throws {
        let padding = String(repeating: "a", count: 5000)
        let raw = GOTRUE_SESSION.replacingOccurrences(of: #""email":"t@x.it""#, with: #""email":"t@x.it","pad":"\#(padding)""#)
        let session = try Session(raw: Data(raw.utf8))

        let cookies = SessionCookie.cookies(for: session, projectRef: "ref")

        XCTAssertEqual(cookies.map(\.name), ["sb-ref-auth-token.0", "sb-ref-auth-token.1", "sb-ref-auth-token.2"])
        XCTAssertEqual(cookies[0].value.count, SessionCookie.chunkSize)
    }

    func testTheWebViewSessionIsReadBackFromItsCookies() throws {
        let padding = String(repeating: "b", count: 4000)
        let raw = GOTRUE_SESSION.replacingOccurrences(of: #""rt1""#, with: #""rt2","pad":"\#(padding)""#)
        let written = SessionCookie.cookies(for: try Session(raw: Data(raw.utf8)), projectRef: "ref")
        let jar = Dictionary(uniqueKeysWithValues: written.map { ($0.name, $0.value) }).merging(["other": "x"]) { a, _ in a }

        let read = SessionCookie.session(from: jar, projectRef: "ref")

        XCTAssertEqual(read?.refreshToken, "rt2")
    }

    func testNoCookieMeansNoSession() {
        XCTAssertNil(SessionCookie.session(from: [:], projectRef: "ref"))
    }
}
