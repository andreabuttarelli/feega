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

public enum ShellFlag: String {
    case appleSignIn = "FeegaAppleSignIn"

    var isOn: Bool {
        Bundle.main.object(forInfoDictionaryKey: rawValue) as? String == "on"
    }
}

public final class FeegaBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    public static let webURL: URL = {
        #if DEBUG
        if let override = ProcessInfo.processInfo.environment["FEEGA_WEB"].flatMap(URL.init(string:)) {
            return override
        }
        #endif
        let configured = Bundle.main.object(forInfoDictionaryKey: "FeegaWebURL") as? String
        return configured.flatMap(URL.init(string:)) ?? URL(string: "https://oh.feega.app")!
    }()

    private var sample = PerfSample()
    private var guardian: TerminationGuardian?
    private var chip: PerfChip?

    override public func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        descriptor.serverURL = Self.webURL.absoluteString
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
        descriptor.appendedUserAgentString = "FeegaNative/mobile-\(version)"
        return descriptor
    }

    override public func capacitorDidLoad() {
        bridge?.registerPluginInstance(FeegaPerfPlugin())
        if ShellFlag.appleSignIn.isOn {
            bridge?.registerPluginInstance(FeegaAppleSignInPlugin())
        }
        guard let webView else {
            return
        }
        guardian = TerminationGuardian(wrapping: webView.navigationDelegate) { [weak self] in self?.webProcessTerminated() }
        webView.navigationDelegate = guardian
        if PerfToggle.isOn {
            installProbe(in: webView)
        }
    }

    public func open(deepLink: URL) {
        guard let target = DeepLink.webURL(for: deepLink, web: Self.webURL) else {
            return
        }
        webView?.load(URLRequest(url: target))
    }

    private func installProbe(in webView: WKWebView) {
        let controller = webView.configuration.userContentController
        controller.addUserScript(WKUserScript(source: PerfScript.source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.add(self, name: PerfScript.handler)

        let chip = PerfChip.make { [weak self] chip in self?.showReport(chip.sample) }
        chip.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(chip)
        NSLayoutConstraint.activate([
            chip.centerXAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerXAnchor),
            chip.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor)
        ])
        self.chip = chip
    }

    private func showReport(_ sample: PerfSample) {
        let alert = UIAlertController(title: "Performance", message: sample.report, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Copy", style: .default) { _ in UIPasteboard.general.string = sample.report })
        alert.addAction(UIAlertAction(title: "Close", style: .cancel))
        present(alert, animated: true)
    }

    private func webProcessTerminated() {
        sample.webProcessTerminations += 1
        NSLog("feega: web content process terminated (%d), reloading", sample.webProcessTerminations)
        chip?.show(sample)
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let values = message.body as? [String: Any] else {
            return
        }
        sample.merge(values, footprintMB: Footprint.megabytes())
        chip?.show(sample)
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
