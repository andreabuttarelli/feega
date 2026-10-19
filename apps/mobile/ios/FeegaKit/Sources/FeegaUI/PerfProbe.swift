#if canImport(UIKit)
import Foundation
import WebKit
import FeegaCore

public enum PerfToggle {
    private static let key = "feega.perfProbe"

    public static var isOn: Bool {
        get { UserDefaults.standard.bool(forKey: key) }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }
}

public struct PerfSample: Equatable {
    public var revealedMs: Double?
    public var interactiveMs: Double?
    public var fps: Double = 0
    public var minFps: Double = 0
    public var longFrames: Int = 0
    public var worstFrameMs: Double = 0
    public var heapMB: Double?
    public var appFootprintMB: Double?
    public var webProcessTerminations: Int = 0
    public var reloads: Int = 0

    public var report: String {
        [
            "revealed: \(revealedMs.map { "\(Int($0)) ms" } ?? "-")",
            "interactive: \(interactiveMs.map { "\(Int($0)) ms" } ?? "-")",
            "fps (1 s): \(Int(fps))  min: \(Int(minFps))",
            "long frames >50 ms: \(longFrames)  worst: \(Int(worstFrameMs)) ms",
            "js heap: \(heapMB.map { String(format: "%.0f MB", $0) } ?? "n/a in WebKit")",
            "app footprint: \(appFootprintMB.map { String(format: "%.0f MB", $0) } ?? "-")",
            "web process terminations: \(webProcessTerminations)  reloads: \(reloads)"
        ].joined(separator: "\n")
    }
}

enum PerfScript {
    static let handler = "feegaPerf"

    static let source = """
    (() => {
      const post = (m) => window.webkit.messageHandlers.\(handler).postMessage(m);
      let revealed = null, interactive = null, frames = 0, last = performance.now(), windowStart = last;
      let longFrames = 0, worst = 0, minFps = Infinity;
      const tick = (now) => {
        const dt = now - last; last = now; frames++;
        if (dt > 50) { longFrames++; }
        if (dt > worst) { worst = dt; }
        if (revealed === null && document.querySelector('[data-canvas-surface][data-revealed="true"]')) {
          revealed = now;
          requestAnimationFrame((n) => { interactive = n; });
        }
        if (now - windowStart >= 1000) {
          const fps = frames * 1000 / (now - windowStart);
          if (revealed !== null && fps < minFps) { minFps = fps; }
          const heap = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null;
          post({ revealed, interactive, fps, minFps: minFps === Infinity ? fps : minFps, longFrames, worst, heap });
          frames = 0; windowStart = now;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })();
    """

    static func install(in controller: WKUserContentController, receiver: WKScriptMessageHandler) {
        controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.add(receiver, name: handler)
    }

    static func merge(_ body: Any, into sample: inout PerfSample) {
        guard let values = body as? [String: Any] else {
            return
        }
        sample.revealedMs = values["revealed"] as? Double ?? sample.revealedMs
        sample.interactiveMs = values["interactive"] as? Double ?? sample.interactiveMs
        sample.fps = values["fps"] as? Double ?? 0
        sample.minFps = values["minFps"] as? Double ?? 0
        sample.longFrames = values["longFrames"] as? Int ?? 0
        sample.worstFrameMs = values["worst"] as? Double ?? 0
        sample.heapMB = values["heap"] as? Double
        sample.appFootprintMB = Footprint.megabytes()
    }
}
#endif
