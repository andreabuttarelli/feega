import Foundation

public struct OrgRef: Codable, Equatable, Sendable {
    public let id: String
    public let name: String
}

public struct ProjectSummary: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let lastActiveAt: String
}

public struct ProjectList: Codable, Equatable, Sendable {
    public let org: OrgRef
    public let projects: [ProjectSummary]
}

public struct CanvasSummary: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let path: String
}

public struct CanvasList: Codable, Equatable, Sendable {
    public let project: OrgRef
    public let canvases: [CanvasSummary]
}
