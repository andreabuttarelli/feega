import Foundation

public struct WebSource: Equatable {
    private static let bundleSetting = "bundle"
    private static let bundleOrigin = URL(string: "capacitor://localhost")!

    public let serverURL: URL?
    public let origin: URL

    public init(setting: String?, hosted: URL) {
        let bundled = setting == Self.bundleSetting
        serverURL = bundled ? nil : hosted
        origin = bundled ? Self.bundleOrigin : hosted
    }
}
