import XCTest
@testable import FeegaCore

final class ListCacheTests: XCTestCase {
    func testTheLastListIsShownOfflineAndForgottenOnSignOut() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let cache = ListCache(directory: dir)
        let list = CanvasList(project: OrgRef(id: "p1", name: "L"), canvases: [CanvasSummary(id: "c1", name: "B", path: "/p/p1/c/c1")])

        cache.save(list, key: "canvases-p1")

        XCTAssertEqual(cache.load(CanvasList.self, key: "canvases-p1"), list)
        cache.clear()
        XCTAssertNil(cache.load(CanvasList.self, key: "canvases-p1"))
    }
}
