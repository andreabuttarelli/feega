#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist-app}"
STAGE="$OUT/stage"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  (cd "$ROOT" && PUBLIC_FEEGA_LOCAL=1 npm run build:node)
fi

rm -rf "$OUT"
mkdir -p "$STAGE/scripts" "$STAGE/src/lib"
cp -R "$ROOT/build" "$STAGE/build"
cp "$ROOT/scripts/local.mjs" "$ROOT/scripts/node-server.mjs" "$STAGE/scripts/"
cp "$ROOT/src/lib/local-ai-keys.js" "$STAGE/src/lib/"
(cd "$ROOT" && npx esbuild cli/mcp/stdio.ts --bundle --platform=node --target=node22 --format=esm \
  --external:open --log-level=error --outfile="$STAGE/mcp.mjs" \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);")
node -e '
  const p = require(process.argv[1]);
  const out = { name: "feega-app", private: true, type: p.type, dependencies: p.dependencies, overrides: p.overrides };
  require("fs").writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
' "$ROOT/package.json" "$STAGE/package.json"

(cd "$STAGE" && npm install --package-lock-only --omit=dev --no-audit --no-fund --loglevel=error)
tar -czf "$OUT/feega-app.tar.gz" -C "$STAGE" .
du -h "$OUT/feega-app.tar.gz"
