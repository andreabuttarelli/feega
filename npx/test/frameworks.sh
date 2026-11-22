#!/bin/sh
run() {
  echo "=== $1"
  FEEGA_E2E_APP="inspect/test/fixtures/$1" FEEGA_E2E_SOURCE="$2" FEEGA_E2E_PORT="${3:-4723}" node npx/test/frameworks.e2e.mjs 2>&1 | tail -8
}
if [ $# -ge 2 ]; then
  run "$@"
  exit
fi
for pair in "vite-vanilla:index.html" "astro-css:index.astro" "nuxt-css:app.vue" "react-router-css:routes/home.tsx"; do
  run "${pair%%:*}" "${pair#*:}"
done
