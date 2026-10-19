import Foundation

public enum DeepLink {
    public static let scheme = "feega"
    private static let authHost = "auth"

    public static func webURL(for link: URL, web: URL) -> URL? {
        guard link.scheme == scheme, link.host == authHost else {
            return nil
        }
        var parts = URLComponents(url: web, resolvingAgainstBaseURL: false)
        parts?.path = "/auth\(link.path)"
        parts?.percentEncodedQuery = URLComponents(url: link, resolvingAgainstBaseURL: false)?.percentEncodedQuery
        return parts?.url
    }
}
