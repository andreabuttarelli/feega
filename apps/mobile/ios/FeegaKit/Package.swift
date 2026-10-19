// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FeegaKit",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "FeegaCore", targets: ["FeegaCore"]),
        .library(name: "FeegaUI", targets: ["FeegaUI"])
    ],
    dependencies: [
        .package(path: "../vendor/capacitor-swift-pm")
    ],
    targets: [
        .target(name: "FeegaCore"),
        .target(
            name: "FeegaUI",
            dependencies: [
                "FeegaCore",
                .product(name: "Capacitor", package: "capacitor-swift-pm", condition: .when(platforms: [.iOS]))
            ]
        ),
        .testTarget(name: "FeegaCoreTests", dependencies: ["FeegaCore"])
    ]
)
