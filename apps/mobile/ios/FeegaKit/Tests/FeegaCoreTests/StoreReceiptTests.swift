import XCTest
@testable import FeegaCore

final class StoreReceiptTests: XCTestCase {
    func testTheOrgIdTagsEveryPurchaseAsItsAccountToken() {
        let org = "7d0c6a2e-4b1f-4a8e-9a43-2f3f1c9b5e10"

        XCTAssertEqual(StoreReceipt.accountToken(appUserId: org), UUID(uuidString: org))
    }

    func testAnAppUserIdThatIsNotAnOrgTagsNothing() {
        XCTAssertNil(StoreReceipt.accountToken(appUserId: "anonymous"))
    }

    func testOnlyAVerifiedTransactionCountsAsPurchased() {
        XCTAssertEqual(StoreReceipt.payload(.verified), ["purchased": true])
        XCTAssertEqual(StoreReceipt.payload(.cancelled), ["purchased": false])
        XCTAssertEqual(StoreReceipt.payload(.pending), ["purchased": false])
        XCTAssertNil(StoreReceipt.payload(.unverified))
    }
}
