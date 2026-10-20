import XCTest
import StoreKitTest

final class StorePurchaseUITests: XCTestCase {
    private struct Rig {
        let session: String
        let orgId: String
        let webhook: URL
        let secret: String
        let shots: URL

        init?(_ env: [String: String]) {
            guard
                let session = env["FEEGA_DEMO_SESSION"],
                let orgId = env["FEEGA_TEST_ORG"],
                let webhook = env["FEEGA_WEBHOOK_URL"].flatMap(URL.init(string:)),
                let secret = env["FEEGA_WEBHOOK_SECRET"],
                let shots = env["FEEGA_SHOTS_DIR"]
            else {
                return nil
            }
            self.session = session
            self.orgId = orgId
            self.webhook = webhook
            self.secret = secret
            self.shots = URL(fileURLWithPath: shots)
        }
    }

    private static let creditsPath = "/app/credits"
    private static let packId = "feega_pack_8"
    private static let planId = "feega_monthly_8"
    private static let wait: TimeInterval = 30

    private var rig: Rig!
    private var store: SKTestSession!
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        guard let rig = Rig(ProcessInfo.processInfo.environment) else {
            throw XCTSkip("needs a local dev server and a test-account session: apps/mobile/README.md")
        }
        self.rig = rig
        store = try SKTestSession(configurationFileNamed: "Products")
        store.resetToDefaultState()
        store.clearTransactions()
        store.disableDialogs = true
        app = XCUIApplication()
        app.launchEnvironment = ["FEEGA_DEMO_SESSION": rig.session, "FEEGA_DEMO_PATH": Self.creditsPath]
    }

    func testBuyingAPackAndAPlanLandsInTheLedgerThroughTheWebhook() throws {
        app.launch()
        let topUp = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Top up'")).firstMatch
        XCTAssertTrue(topUp.waitForExistence(timeout: Self.wait))
        shot("1-paywall")

        topUp.tap()
        let done = app.webViews.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Purchase complete'")).firstMatch
        XCTAssertTrue(done.waitForExistence(timeout: Self.wait))
        shot("2-pack-bought")
        try deliver("INITIAL_PURCHASE", product: Self.packId)

        app.webViews.buttons["Subscribe"].firstMatch.tap()
        XCTAssertTrue(done.waitForExistence(timeout: Self.wait))
        try deliver("INITIAL_PURCHASE", product: Self.planId)

        app.terminate()
        app.launch()
        let currentPlan = app.webViews.staticTexts["Current plan"]
        XCTAssertTrue(currentPlan.waitForExistence(timeout: Self.wait))
        shot("3-credits-and-plan")

        app.webViews.buttons["Restore purchases"].tap()
        XCTAssertTrue(done.waitForExistence(timeout: Self.wait))
        shot("4-restored")

        let plan = try XCTUnwrap(store.allTransactions().first { $0.productIdentifier == Self.planId })
        try store.refundTransaction(identifier: plan.identifier)
        try deliver("CANCELLATION", product: Self.packId, cancelReason: "CUSTOMER_SUPPORT")
        try deliver("CANCELLATION", product: Self.planId, cancelReason: "CUSTOMER_SUPPORT")
        app.terminate()
        app.launch()
        XCTAssertTrue(topUp.waitForExistence(timeout: Self.wait))
        XCTAssertFalse(currentPlan.exists)
        shot("5-refunded")
    }

    private func deliver(_ type: String, product: String, cancelReason: String? = nil) throws {
        var event: [String: Any] = [
            "id": UUID().uuidString,
            "type": type,
            "app_user_id": rig.orgId,
            "product_id": product,
            "store": "APP_STORE",
            "environment": "SANDBOX",
            "expiration_at_ms": Int(Date().addingTimeInterval(30 * 86_400).timeIntervalSince1970 * 1000)
        ]
        event["cancel_reason"] = cancelReason
        var request = URLRequest(url: rig.webhook)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue("Bearer \(rig.secret)", forHTTPHeaderField: "authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["api_version": "1.0", "event": event])

        let done = expectation(description: "webhook \(type)")
        var status = 0
        URLSession.shared.dataTask(with: request) { _, response, _ in
            status = (response as? HTTPURLResponse)?.statusCode ?? 0
            done.fulfill()
        }.resume()
        wait(for: [done], timeout: Self.wait)
        XCTAssertEqual(status, 200, "webhook \(type)")
    }

    private func shot(_ name: String) {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        try? png.write(to: rig.shots.appendingPathComponent("\(name).png"))
    }
}
