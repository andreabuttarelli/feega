#!/usr/bin/env bash
set -euo pipefail

VERSION=8.5.3
DIR="$(cd "$(dirname "$0")/.." && pwd)/ios/vendor/capacitor-swift-pm"
RELEASES="https://github.com/ionic-team/capacitor-swift-pm/releases/download/$VERSION"

mkdir -p "$DIR"
cd "$DIR"
for framework in Capacitor Cordova; do
  if [ ! -d "$framework.xcframework" ]; then
    curl -sfL -o "$framework.zip" "$RELEASES/$framework.xcframework.zip"
    unzip -q -o "$framework.zip"
    rm "$framework.zip"
  fi
done

cat > Package.swift <<EOF
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "capacitor-swift-pm",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "Capacitor", targets: ["Capacitor"]),
        .library(name: "Cordova", targets: ["Cordova"])
    ],
    targets: [
        .binaryTarget(name: "Capacitor", path: "Capacitor.xcframework"),
        .binaryTarget(name: "Cordova", path: "Cordova.xcframework")
    ]
)
EOF
echo "vendored capacitor-swift-pm $VERSION in $DIR"
