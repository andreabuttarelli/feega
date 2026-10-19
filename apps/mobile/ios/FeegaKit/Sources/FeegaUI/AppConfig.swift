import Foundation

public struct AppConfig: Sendable {
    public let supabaseURL: URL
    public let anonKey: String
    public let apiBase: URL
    public let webBase: URL

    public var projectRef: String {
        supabaseURL.host?.components(separatedBy: ".").first ?? ""
    }

    public static func fromBundle(_ bundle: Bundle = .main) -> AppConfig {
        guard
            let file = bundle.url(forResource: "FeegaConfig", withExtension: "plist"),
            let data = try? Data(contentsOf: file),
            let values = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: String],
            let supabase = values["SupabaseURL"].flatMap(URL.init(string:)),
            let anonKey = values["SupabaseAnonKey"],
            let web = values["WebBase"].flatMap(URL.init(string:))
        else {
            fatalError("FeegaConfig.plist missing: run `npm run config` in apps/mobile")
        }
        let api = values["ApiBase"].flatMap(URL.init(string:)) ?? web
        return AppConfig(supabaseURL: supabase, anonKey: anonKey, apiBase: api, webBase: web)
    }
}
