#!/bin/sh
set -e
cd "$(dirname "$0")/.."
OUT="${OUT:-out}"
mkdir -p "$OUT"
for f in "$@"; do
  npx remotion still src/index.ts ColdOpen "$OUT/f$f.png" --frame="$f" --log=error
done
