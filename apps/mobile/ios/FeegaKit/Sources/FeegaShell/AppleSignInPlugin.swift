#if canImport(UIKit)
import UIKit
import AuthenticationServices
import Capacitor

public final class FeegaAppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "FeegaAppleSignInPlugin"
    public let jsName = "FeegaAppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)]
    private var pending: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce") else {
            call.reject("nonce_required")
            return
        }
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = nonce
        pending = call
        DispatchQueue.main.async {
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let token = credential.identityToken.flatMap({ String(data: $0, encoding: .utf8) })
        else {
            pending?.reject("no_identity_token")
            return
        }
        let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let name = [credential.fullName?.givenName, credential.fullName?.familyName].compactMap { $0 }.joined(separator: " ")
        pending?.resolve(["identityToken": token, "authorizationCode": code, "fullName": name])
        pending = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        pending?.reject((error as? ASAuthorizationError)?.code == .canceled ? "cancelled" : error.localizedDescription)
        pending = nil
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
#endif
