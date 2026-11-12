# Desktop: ship only what the local server loads

The macOS dmg was 346 MB, the installed app 1.1 GB. `stage-server.cjs` installed every root
`dependency` into the bundled server: 703 MB of `node_modules`, most of it build-time or
client-only (`@sentry/cli`, `vite`, `@esbuild`, `three`, `shaders`, `@napi-rs/canvas`, the full
`typescript`/`pdfjs-dist`).

Now, after the install, `scripts/prune.cjs` traces `build/` (server side), `scripts/*.mjs` and
`src/*.js` with `@vercel/nft` and deletes every `node_modules` file the trace does not reach, plus
`build/**/*.map` and the `.gz`/`.br` copies sirv only uses when present. One exception table:
`node_modules/ffmpeg-static/ffmpeg`, which `ffmpeg-bin.ts` finds by path, not by import.
`after-pack.cjs` drops every Electron Framework locale but `en.lproj`; `compression: maximum`.

arm64, same code: dmg 346 → 166 MB, app 1094 → 421 MB (server 824 → 208, node_modules 703 → 136).

Kept and reported, not removed: Stripe, Sentry and OpenTelemetry are reached by the server build
(~7 MB after file-level pruning); stubbing them for local mode would need a hosted-only seam in
the app. Discarded: a package-level allowlist (417 MB, traced packages ship whole) and
downloading the server on first open (offline first run breaks).
