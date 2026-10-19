#if canImport(UIKit) && DEBUG
import Foundation
import WebKit

enum DemoScript {
    static func install(in controller: WKUserContentController) {
        let env = ProcessInfo.processInfo.environment
        guard let email = env["FEEGA_DEMO_EMAIL"], let password = env["FEEGA_DEMO_PASSWORD"] else {
            return
        }
        let path = env["FEEGA_DEMO_PATH"] ?? ""
        let source = """
        (() => {
          const creds = \(json(["email": email, "password": password, "path": path]));
          const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
          const tick = setInterval(() => {
            const form = document.querySelector('[data-testid="native-login-form"]');
            if (form) {
              set(form.querySelector('input[name="email"]'), creds.email);
              set(form.querySelector('input[name="password"]'), creds.password);
              form.requestSubmit();
              clearInterval(tick);
              return;
            }
            const canvas = document.querySelector('a[href*="/c/"]');
            if (creds.path && canvas && !sessionStorage.getItem('demo-went')) {
              sessionStorage.setItem('demo-went', '1');
              canvas.click();
              clearInterval(tick);
            }
          }, 500);
        })();
        """
        controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
    }

    private static func json(_ values: [String: String]) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: values)) ?? Data("{}".utf8)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}
#endif
