import XCTest
@testable import FeegaCore

final class DeepLinkTests: XCTestCase {
    let web = URL(string: "https://oh.feega.app")!

    func testTheOAuthReturnOpensTheWebCallbackWithItsQuery() {
        let link = URL(string: "feega://auth/callback?code=abc&next=%2Fapp")!

        XCTAssertEqual(DeepLink.webURL(for: link, web: web)?.absoluteString, "https://oh.feega.app/auth/callback?code=abc&next=%2Fapp")
    }

    func testInTheBundleTheOAuthReturnOpensTheBundledCallback() {
        let bundle = WebSource(setting: "bundle", hosted: web).origin
        let link = URL(string: "feega://auth/callback?code=abc&next=%2Fapp")!

        XCTAssertEqual(DeepLink.webURL(for: link, web: bundle)?.absoluteString, "capacitor://localhost/auth/callback?code=abc&next=%2Fapp")
    }

    func testAnyOtherSchemeOrHostIsIgnored() {
        XCTAssertNil(DeepLink.webURL(for: URL(string: "https://evil.test/auth/callback?code=x")!, web: web))
        XCTAssertNil(DeepLink.webURL(for: URL(string: "feega://other/path")!, web: web))
    }
}
