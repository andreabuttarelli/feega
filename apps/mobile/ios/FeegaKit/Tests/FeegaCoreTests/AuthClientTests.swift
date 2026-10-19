import XCTest
@testable import FeegaCore

final class AuthClientTests: XCTestCase {
    let base = URL(string: "https://ref.supabase.co")!

    func testSignInPostsPasswordGrantWithAnonKey() async throws {
        let transport = FakeTransport([(200, GOTRUE_SESSION)])
        let auth = AuthClient(supabaseURL: base, anonKey: "anon", transport: transport)

        let session = try await auth.signIn(email: "t@x.it", password: "pw")

        XCTAssertEqual(session.accessToken, "at1")
        XCTAssertEqual(session.refreshToken, "rt1")
        let request = transport.sent[0]
        XCTAssertEqual(request.url?.absoluteString, "https://ref.supabase.co/auth/v1/token?grant_type=password")
        XCTAssertEqual(request.value(forHTTPHeaderField: "apikey"), "anon")
        let body = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: String]
        XCTAssertEqual(body, ["email": "t@x.it", "password": "pw"])
    }

    func testWrongPasswordIsRejectedWithTheServerMessage() async {
        let transport = FakeTransport([(400, #"{"error":"invalid_grant","error_description":"Invalid login credentials"}"#)])
        let auth = AuthClient(supabaseURL: base, anonKey: "anon", transport: transport)

        do {
            _ = try await auth.signIn(email: "t@x.it", password: "bad")
            XCTFail("expected rejection")
        } catch {
            XCTAssertEqual(error as? AuthError, .rejected("Invalid login credentials"))
        }
    }

    func testAppleSignInSendsTheIdTokenAndRawNonce() async throws {
        let transport = FakeTransport([(200, GOTRUE_SESSION)])
        let auth = AuthClient(supabaseURL: base, anonKey: "anon", transport: transport)

        _ = try await auth.signInWithApple(idToken: "jwt", nonce: "raw")

        XCTAssertEqual(transport.sent[0].url?.query, "grant_type=id_token")
        let body = try JSONSerialization.jsonObject(with: transport.sent[0].httpBody!) as! [String: String]
        XCTAssertEqual(body, ["provider": "apple", "id_token": "jwt", "nonce": "raw"])
    }

    func testRefreshUsesTheRefreshToken() async throws {
        let transport = FakeTransport([(200, GOTRUE_SESSION)])
        let auth = AuthClient(supabaseURL: base, anonKey: "anon", transport: transport)

        _ = try await auth.refresh(refreshToken: "rt0")

        XCTAssertEqual(transport.sent[0].url?.query, "grant_type=refresh_token")
        let body = try JSONSerialization.jsonObject(with: transport.sent[0].httpBody!) as! [String: String]
        XCTAssertEqual(body, ["refresh_token": "rt0"])
    }
}
