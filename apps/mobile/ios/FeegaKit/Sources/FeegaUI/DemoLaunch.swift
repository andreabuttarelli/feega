import Foundation

struct DemoLaunch {
    let email: String?
    let password: String?
    let projectIndex: Int?
    let canvasIndex: Int?

    static let current: DemoLaunch = {
        #if DEBUG
        let env = ProcessInfo.processInfo.environment
        return DemoLaunch(
            email: env["FEEGA_DEMO_EMAIL"],
            password: env["FEEGA_DEMO_PASSWORD"],
            projectIndex: env["FEEGA_DEMO_PROJECT"].flatMap(Int.init),
            canvasIndex: env["FEEGA_DEMO_CANVAS"].flatMap(Int.init)
        )
        #else
        return DemoLaunch(email: nil, password: nil, projectIndex: nil, canvasIndex: nil)
        #endif
    }()
}
