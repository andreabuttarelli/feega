import XCTest
@testable import FeegaCore

final class WebSourceTests: XCTestCase {
    let hosted = URL(string: "https://oh.feega.app")!

    func testTheHostedAppIsLoadedFromItsServer() {
        let source = WebSource(setting: "hosted", hosted: hosted)

        XCTAssertEqual(source.serverURL, hosted)
        XCTAssertEqual(source.origin, hosted)
    }

    func testTheBundleIsServedByCapacitorItself() {
        let source = WebSource(setting: "bundle", hosted: hosted)

        XCTAssertNil(source.serverURL)
        XCTAssertEqual(source.origin.absoluteString, "capacitor://localhost")
    }

    func testAMissingOrUnknownSettingFallsBackToTheHostedApp() {
        XCTAssertEqual(WebSource(setting: nil, hosted: hosted).serverURL, hosted)
        XCTAssertEqual(WebSource(setting: "other", hosted: hosted).serverURL, hosted)
    }
}
