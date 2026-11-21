#!/bin/bash
set -euo pipefail

[ "$(uname)" = "Darwin" ] || exit 0

here="$(cd "$(dirname "$0")" && pwd)"
bundle="$here/../../build/native/FeegaAppleSignIn.app"
macos="$bundle/Contents/MacOS"
name="feega-apple-signin"

rm -rf "$bundle"
mkdir -p "$macos"

for arch in arm64 x86_64; do
  swiftc -O -target "$arch-apple-macos12.0" -framework AuthenticationServices -framework AppKit \
    "$here/main.swift" -o "$macos/$name-$arch"
done
lipo -create "$macos/$name-arm64" "$macos/$name-x86_64" -output "$macos/$name"
rm "$macos/$name-arm64" "$macos/$name-x86_64"
cp "$here/Info.plist" "$bundle/Contents/Info.plist"

if [ -n "${FEEGA_SIGN_IDENTITY:-}" ] && [ -n "${FEEGA_PROVISIONING_PROFILE:-}" ] && [ -n "${FEEGA_TEAM_ID:-}" ]; then
  cp "$FEEGA_PROVISIONING_PROFILE" "$bundle/Contents/embedded.provisionprofile"
  entitlements="$(mktemp)"
  sed "s/\$(TEAM_ID)/$FEEGA_TEAM_ID/g" "$here/apple-signin.entitlements" > "$entitlements"
  codesign --force --options runtime --timestamp --sign "$FEEGA_SIGN_IDENTITY" --entitlements "$entitlements" "$bundle"
  rm "$entitlements"
else
  codesign --force --sign - "$bundle"
fi
