#!/usr/bin/env bash
set -euo pipefail

MOBILE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$MOBILE/../.." && pwd)"
API="${FEEGA_API:-https://oh.feega.app}"
WEB="${FEEGA_WEB:-https://oh.feega.app}"

(cd "$ROOT" && PUBLIC_API_BASE="$API" PUBLIC_APP_URL="$WEB" npm run build:spa)
rm -rf "$MOBILE/www"
cp -R "$ROOT/build-spa" "$MOBILE/www"
(cd "$MOBILE" && npx cap copy ios)
echo "bundled build-spa into www (API $API, public pages $WEB)"
