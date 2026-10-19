#!/usr/bin/env bash
set -euo pipefail

MOBILE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$MOBILE/../.." && pwd)"
API="${FEEGA_API:-https://oh.feega.app}"

(cd "$ROOT" && PUBLIC_API_BASE="$API" npm run build:spa)
rm -rf "$MOBILE/www"
cp -R "$ROOT/build-spa" "$MOBILE/www"
plutil -replace FeegaWebSource -string bundle "$MOBILE/ios/App/App/Info.plist"
(cd "$MOBILE" && npx cap copy ios)
echo "bundled build-spa (API $API); git checkout -- www ios/App/App/Info.plist returns to the hosted app"
