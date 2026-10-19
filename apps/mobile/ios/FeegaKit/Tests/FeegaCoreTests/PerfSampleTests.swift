import XCTest
@testable import FeegaCore

final class PerfSampleTests: XCTestCase {
    func testAProbeMessageUpdatesTheSampleAndKeepsTheTerminationCount() {
        var sample = PerfSample()
        sample.webProcessTerminations = 2

        sample.merge(["revealed": 3781.0, "interactive": 3801.0, "fps": 59.6, "minFps": 15.0, "longFrames": 5, "worst": 740.0], footprintMB: 56)

        XCTAssertEqual(sample.revealedMs, 3781)
        XCTAssertEqual(sample.longFrames, 5)
        XCTAssertEqual(sample.webProcessTerminations, 2)
        XCTAssertTrue(sample.report.contains("revealed: 3781 ms"))
        XCTAssertTrue(sample.report.contains("js heap: n/a in WebKit"))
        XCTAssertTrue(sample.report.contains("app footprint: 56 MB"))
    }

    func testARevealSeenOnceIsNotForgottenByLaterMessages() {
        var sample = PerfSample()
        sample.merge(["revealed": 100.0], footprintMB: nil)

        sample.merge(["fps": 60.0], footprintMB: nil)

        XCTAssertEqual(sample.revealedMs, 100)
    }
}
