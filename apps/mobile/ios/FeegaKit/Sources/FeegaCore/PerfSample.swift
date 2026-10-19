import Foundation

public struct PerfSample: Equatable, Sendable {
    public var revealedMs: Double?
    public var interactiveMs: Double?
    public var fps: Double = 0
    public var minFps: Double = 0
    public var longFrames: Int = 0
    public var worstFrameMs: Double = 0
    public var heapMB: Double?
    public var appFootprintMB: Double?
    public var webProcessTerminations: Int = 0

    public init() {}

    public mutating func merge(_ values: [String: Any], footprintMB: Double?) {
        revealedMs = values["revealed"] as? Double ?? revealedMs
        interactiveMs = values["interactive"] as? Double ?? interactiveMs
        fps = values["fps"] as? Double ?? fps
        minFps = values["minFps"] as? Double ?? minFps
        longFrames = values["longFrames"] as? Int ?? longFrames
        worstFrameMs = values["worst"] as? Double ?? worstFrameMs
        heapMB = values["heap"] as? Double
        appFootprintMB = footprintMB
    }

    public var report: String {
        [
            "revealed: \(revealedMs.map { "\(Int($0)) ms" } ?? "-")",
            "interactive: \(interactiveMs.map { "\(Int($0)) ms" } ?? "-")",
            "fps (1 s): \(Int(fps))  min: \(Int(minFps))",
            "long frames >50 ms: \(longFrames)  worst: \(Int(worstFrameMs)) ms",
            "js heap: \(heapMB.map { String(format: "%.0f MB", $0) } ?? "n/a in WebKit")",
            "app footprint: \(appFootprintMB.map { String(format: "%.0f MB", $0) } ?? "-")",
            "web process terminations (reloaded): \(webProcessTerminations)"
        ].joined(separator: "\n")
    }
}
