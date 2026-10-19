#if canImport(UIKit)
import UIKit
import WebKit
import Capacitor
import FeegaCore

public final class FeegaPerfPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FeegaPerfPlugin"
    public let jsName = "FeegaPerf"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "footprint", returnType: CAPPluginReturnPromise)]

    @objc func footprint(_ call: CAPPluginCall) {
        call.resolve(["megabytes": Footprint.megabytes() ?? -1])
    }
}

final class WebSurfaceController: CAPBridgeViewController, WKScriptMessageHandler {
    private let origin: URL
    private let path: String
    private let probe: Bool
    var onSample: ((PerfSample) -> Void)?
    private var sample = PerfSample()
    private var guardian: TerminationGuardian?

    init(origin: URL, path: String, probe: Bool) {
        self.origin = origin
        self.path = path
        self.probe = probe
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        descriptor.serverURL = URL(string: path, relativeTo: origin)?.absoluteString
        descriptor.appendedUserAgentString = "FeegaMobile/1"
        return descriptor
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FeegaPerfPlugin())
        guard let webView else {
            return
        }
        guardian = TerminationGuardian(wrapping: webView.navigationDelegate) { [weak self] in self?.webProcessTerminated() }
        webView.navigationDelegate = guardian
        if probe {
            PerfScript.install(in: webView.configuration.userContentController, receiver: self)
        }
    }

    private func webProcessTerminated() {
        sample.webProcessTerminations += 1
        sample.reloads += 1
        NSLog("feega: web content process terminated, reloading %@", path)
        onSample?(sample)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        PerfScript.merge(message.body, into: &sample)
        onSample?(sample)
    }
}

final class TerminationGuardian: NSObject, WKNavigationDelegate {
    private weak var inner: WKNavigationDelegate?
    private let onTerminate: () -> Void

    init(wrapping inner: WKNavigationDelegate?, onTerminate: @escaping () -> Void) {
        self.inner = inner
        self.onTerminate = onTerminate
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        onTerminate()
        guard inner?.webViewWebContentProcessDidTerminate?(webView) != nil else {
            webView.reload()
            return
        }
    }

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || (inner?.responds(to: aSelector) ?? false)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        inner?.responds(to: aSelector) == true ? inner : nil
    }
}
#endif
