import AppKit
import AuthenticationServices
import Security

let entitlementKey = "com.apple.developer.applesignin"

func emit(_ object: [String: Any]) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write("\n".data(using: .utf8)!)
    exit(object["error"] == nil ? 0 : 1)
}

func fail(_ code: String, _ message: String) -> Never {
    emit(["error": ["code": code, "message": message]])
}

func isEntitled() -> Bool {
    guard let task = SecTaskCreateFromSelf(nil) else {
        return false
    }
    return SecTaskCopyValueForEntitlement(task, entitlementKey as CFString, nil) != nil
}

func requireEntitled() {
    if !isEntitled() {
        fail("not_entitled", "The helper is not signed with the Sign in with Apple entitlement")
    }
}

func code(for error: Error) -> String {
    guard let failure = error as? ASAuthorizationError else {
        return "failed"
    }
    switch failure.code {
    case .canceled: return "cancelled"
    case .notHandled, .unknown: return "not_available"
    default: return "failed"
    }
}

final class Session: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1, height: 1), styleMask: [], backing: .buffered, defer: true)

    func start(hashedNonce: String) {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = hashedNonce
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        window
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              let codeData = credential.authorizationCode,
              let authCode = String(data: codeData, encoding: .utf8) else {
            fail("failed", "Apple returned no identity token")
        }
        var output: [String: Any] = ["identityToken": token, "authorizationCode": authCode, "user": credential.user]
        output["givenName"] = credential.fullName?.givenName
        output["familyName"] = credential.fullName?.familyName
        output["email"] = credential.email
        emit(output)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        fail(code(for: error), error.localizedDescription)
    }
}

let arguments = CommandLine.arguments

switch arguments.dropFirst().first {
case "check":
    requireEntitled()
    emit(["available": true])
case "sign-in":
    guard let flag = arguments.firstIndex(of: "--nonce"), arguments.indices.contains(flag + 1) else {
        fail("bad_arguments", "Missing --nonce <sha256 hex>")
    }
    requireEntitled()
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    let session = Session()
    session.start(hashedNonce: arguments[flag + 1])
    app.run()
default:
    fail("bad_arguments", "Usage: feega-apple-signin check | sign-in --nonce <sha256 hex>")
}
