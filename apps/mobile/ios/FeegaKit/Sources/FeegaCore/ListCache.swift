import Foundation

public struct ListCache: Sendable {
    private let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    public func save<T: Encodable>(_ value: T, key: String) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? JSONEncoder().encode(value).write(to: file(key), options: .atomic)
    }

    public func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = try? Data(contentsOf: file(key)) else {
            return nil
        }
        return try? JSONDecoder().decode(type, from: data)
    }

    public func clear() {
        try? FileManager.default.removeItem(at: directory)
    }

    private func file(_ key: String) -> URL {
        directory.appendingPathComponent("\(key).json")
    }
}
