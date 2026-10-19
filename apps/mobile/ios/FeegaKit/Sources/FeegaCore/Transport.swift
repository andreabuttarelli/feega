import Foundation

public protocol Transport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, Int)
}

public struct URLSessionTransport: Transport {
    public init() {}

    public func send(_ request: URLRequest) async throws -> (Data, Int) {
        let (data, response) = try await URLSession.shared.data(for: request)
        return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
    }
}

func jsonRequest(_ url: URL, method: String = "GET", body: [String: String]? = nil, headers: [String: String] = [:]) -> URLRequest {
    var request = URLRequest(url: url)
    request.httpMethod = method
    for (name, value) in headers {
        request.setValue(value, forHTTPHeaderField: name)
    }
    guard let body else {
        return request
    }
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    return request
}
