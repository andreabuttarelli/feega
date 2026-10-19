#if canImport(UIKit)
import UIKit
import WebKit
import FeegaCore

enum PerfToggle {
    static var isOn: Bool {
        UserDefaults.standard.bool(forKey: "feega.perfProbe")
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
}

final class PerfChip: UIButton {
    private(set) var sample = PerfSample()

    func show(_ fresh: PerfSample) {
        sample = fresh
        setTitle("\(Int(fresh.fps)) fps · \(Int(fresh.appFootprintMB ?? 0)) MB", for: .normal)
    }

    static func make(onTap: @escaping (PerfChip) -> Void) -> PerfChip {
        let chip = PerfChip(type: .system)
        chip.titleLabel?.font = .monospacedSystemFont(ofSize: 11, weight: .medium)
        chip.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        chip.setTitleColor(.white, for: .normal)
        chip.layer.cornerRadius = 4
        chip.contentEdgeInsets = UIEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
        chip.accessibilityIdentifier = "perf-chip"
        chip.addAction(UIAction { _ in onTap(chip) }, for: .touchUpInside)
        return chip
    }
}
#endif
