# Desktop launch: web renderer, hardened shell

The macOS app ships with the web renderer (WebGPU, WebGL fallback) only. The native canvas is
still broken (overlay desync, stutter, camera drift), so it cannot reach a user: `wanted()`
refuses the flag when packaged, `package.json` no longer lists the addon, the preload or
`native-canvas.cjs`, and `app-release.yml` drops the Rust build and fails if `native/` appears in
the app. Tests pin both.

Shell: window preferences are explicit (isolation, sandbox, no node). Links leaving the app open
only if `http(s)` or `mailto`; `file:`, `smb:` and app schemes from a page are dropped.

Release: `app-release.yml` runs on every push to `main`, not on a tag. The first merge of
`dev` to `main` after this change publishes `app-v<next>`. See `docs/desktop-launch.md`.
