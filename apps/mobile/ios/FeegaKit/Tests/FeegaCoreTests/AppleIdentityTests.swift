import XCTest
@testable import FeegaCore

final class AppleIdentityTests: XCTestCase {
    func testTheIdentityTokenGoesToThePageAsText() {
        let identity = AppleIdentity(token: Data("eyJ.token".utf8), code: Data("c0de".utf8), givenName: "Ada", familyName: "Lovelace")

        XCTAssertEqual(identity?.payload, ["identityToken": "eyJ.token", "authorizationCode": "c0de", "fullName": "Ada Lovelace"])
    }

    func testAppleSendsTheNameOnlyOnceSoItsAbsenceIsNotAFailure() {
        let identity = AppleIdentity(token: Data("eyJ.token".utf8), code: nil, givenName: nil, familyName: nil)

        XCTAssertEqual(identity?.payload, ["identityToken": "eyJ.token", "authorizationCode": "", "fullName": ""])
    }

    func testNoTokenIsNoIdentity() {
        XCTAssertNil(AppleIdentity(token: nil, code: nil, givenName: "Ada", familyName: nil))
    }
}
