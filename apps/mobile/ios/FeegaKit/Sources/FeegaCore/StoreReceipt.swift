import Foundation

public enum StoreReceipt {
    public enum Outcome {
        case verified
        case unverified
        case cancelled
        case pending
    }

    public static func accountToken(appUserId: String) -> UUID? {
        UUID(uuidString: appUserId)
    }

    public static func payload(_ outcome: Outcome) -> [String: Bool]? {
        switch outcome {
        case .verified:
            return ["purchased": true]
        case .cancelled, .pending:
            return ["purchased": false]
        case .unverified:
            return nil
        }
    }
}
