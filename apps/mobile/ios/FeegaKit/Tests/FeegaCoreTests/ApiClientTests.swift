import XCTest
@testable import FeegaCore

final class StubTokens: TokenSource, @unchecked Sendable {
    var token = "old"
    var refreshes = 0

    func accessToken() async throws -> String { token }

    func refreshedToken() async throws -> String {
        refreshes += 1
        token = "new"
        return token
    }
}

final class ApiClientTests: XCTestCase {
    let base = URL(string: "https://app.test")!

    func testProjectsAreReadWithTheBearerAndTheOrgHint() async throws {
        let transport = FakeTransport([(200, #"{"org":{"id":"o1","name":"Acme"},"projects":[{"id":"p1","name":"Launch","lastActiveAt":"2026-10-19"}]}"#)])
        let api = ApiClient(base: base, transport: transport, tokens: StubTokens())

        let list = try await api.projects(org: "o1")

        XCTAssertEqual(list.projects.first?.name, "Launch")
        XCTAssertEqual(transport.sent[0].url?.absoluteString, "https://app.test/api/v1/me/projects?org=o1")
        XCTAssertEqual(transport.sent[0].value(forHTTPHeaderField: "Authorization"), "Bearer old")
    }

    func testAnExpiredTokenIsRefreshedOnceAndTheCallRetried() async throws {
        let transport = FakeTransport([(401, #"{"error":"invalid_token"}"#), (200, #"{"project":{"id":"p1","name":"L"},"canvases":[{"id":"c1","name":"Board","path":"/p/p1/c/c1"}]}"#)])
        let tokens = StubTokens()
        let api = ApiClient(base: base, transport: transport, tokens: tokens)

        let list = try await api.canvases(projectId: "p1")

        XCTAssertEqual(list.canvases.first?.path, "/p/p1/c/c1")
        XCTAssertEqual(tokens.refreshes, 1)
        XCTAssertEqual(transport.sent[1].value(forHTTPHeaderField: "Authorization"), "Bearer new")
    }

    func testTwoRefusalsInARowAreUnauthorized() async {
        let transport = FakeTransport([(401, "{}"), (401, "{}")])
        let api = ApiClient(base: base, transport: transport, tokens: StubTokens())

        do {
            _ = try await api.projects(org: nil)
            XCTFail("expected unauthorized")
        } catch {
            XCTAssertEqual(error as? ApiError, .unauthorized)
        }
    }

    func testAServerErrorCarriesItsCode() async {
        let transport = FakeTransport([(404, #"{"error":"project_not_found"}"#)])
        let api = ApiClient(base: base, transport: transport, tokens: StubTokens())

        do {
            _ = try await api.canvases(projectId: "zz")
            XCTFail("expected error")
        } catch {
            XCTAssertEqual(error as? ApiError, .refused(404, "project_not_found"))
        }
    }
}
