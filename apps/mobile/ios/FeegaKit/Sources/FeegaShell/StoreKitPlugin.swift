#if canImport(UIKit)
import StoreKit
import Capacitor
import FeegaCore

public final class FeegaStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FeegaStoreKitPlugin"
    public let jsName = "FeegaStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), let appUserId = call.getString("appUserId") else {
            call.reject("product_and_app_user_required")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    call.reject("unknown_product")
                    return
                }
                let options = StoreReceipt.accountToken(appUserId: appUserId).map { [Product.PurchaseOption.appAccountToken($0)] } ?? []
                let outcome = try await outcome(of: product.purchase(options: Set(options)))
                guard let payload = StoreReceipt.payload(outcome) else {
                    call.reject("unverified_transaction")
                    return
                }
                call.resolve(payload)
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["purchased": true])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private func outcome(of result: Product.PurchaseResult) async -> StoreReceipt.Outcome {
        switch result {
        case .success(.verified(let transaction)):
            await transaction.finish()
            return .verified
        case .success(.unverified):
            return .unverified
        case .pending:
            return .pending
        case .userCancelled:
            return .cancelled
        @unknown default:
            return .cancelled
        }
    }
}
#endif
