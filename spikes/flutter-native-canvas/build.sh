#!/bin/bash
# Builds the Rust engine + Flutter macOS app and bundles dylib + scene into the .app.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
scene_dir="${1:?usage: build.sh <dir containing scene.json and images/>}"
(cd "$here/native" && CARGO_TARGET_DIR="$here/native/target" cargo build --release)
(cd "$here/app" && flutter build macos --release)
app="$here/app/build/macos/Build/Products/Release/feega_canvas.app"
mkdir -p "$app/Contents/Frameworks" "$app/Contents/Resources/scene"
cp "$here/native/target/release/libfeega_canvas_native.dylib" "$app/Contents/Frameworks/"
cp "$scene_dir/scene.json" "$app/Contents/Resources/scene/"
rsync -a "$scene_dir/images" "$app/Contents/Resources/scene/"
codesign --force --deep -s - "$app"
echo "$app"
