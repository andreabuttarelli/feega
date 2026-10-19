import XCTest
@testable import FeegaCore

final class ContractTests: XCTestCase {
    private func schema() throws -> [String: Any] {
        let file = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("contract/api.schema.json")
        let json = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
        return json["$defs"] as! [String: Any]
    }

    private func required(_ def: Any?, _ path: [String] = []) -> Set<String> {
        var node = def as? [String: Any]
        for key in path {
            let properties = node?["properties"] as? [String: Any]
            let child = properties?[key] as? [String: Any]
            node = (child?["items"] as? [String: Any]) ?? child
        }
        return Set(node?["required"] as? [String] ?? [])
    }

    private func keys<T: Encodable>(_ value: T) throws -> Set<String> {
        Set((try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as! [String: Any]).keys)
    }

    func testSwiftModelsCarryEveryFieldTheTypeScriptContractRequires() throws {
        let defs = try schema()
        let project = ProjectSummary(id: "p", name: "n", lastActiveAt: "t")
        let canvas = CanvasSummary(id: "c", name: "n", path: "/p")

        XCTAssertEqual(try keys(ProjectList(org: OrgRef(id: "o", name: "n"), projects: [project])), required(defs["ProjectList"]))
        XCTAssertEqual(try keys(OrgRef(id: "o", name: "n")), required(defs["ProjectList"], ["org"]))
        XCTAssertEqual(try keys(project), required(defs["ProjectList"], ["projects"]))
        XCTAssertEqual(try keys(CanvasList(project: OrgRef(id: "p", name: "n"), canvases: [canvas])), required(defs["CanvasList"]))
        XCTAssertEqual(try keys(canvas), required(defs["CanvasList"], ["canvases"]))
    }
}
