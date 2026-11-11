# Desktop app opens the hosted app by default

PR #1929 made the macOS app local-only. It is meant to be the desktop web app, so the hosted
app (`oh.feega.app`) is the default again: login, orgs, billing, AI. OAuth leaves for the system
browser (Google blocks embedded webviews) and returns through `feega://auth/callback`, which the
web app already targets for `FeegaNative` user agents.

Local mode stays: File → Open Local File…, opening or dropping a `.feega` file. The last local
file is no longer reopened at launch.

Added: Settings… (⌘,) to the current project's settings, Help menu, downloads through the save
dialog, offline page with retry, remembered window bounds.

Kept the bundled server (~340 MB dmg): local mode and code-folder import need it. Shipping it as
an on-demand download is the way to shrink the dmg; not done here.

## Native canvas back in the build

`desktop-native` CI had failed since 27/10: `Cargo.lock` was stale for `--locked`, and the addon
no longer compiled against `gpu-core` (`Draw.output`, `Reprojector::draw` taking the queue,
`set_overlay` taking an `OverlayPart`). Fixed to mirror `web.rs`; `native-apps.yml` now also
runs on `packages/gpu-core/**` so the addon breaks in the PR that breaks it.

The release package does NOT carry the addon, its preload or the Rust build (launch decision
11/11): a packaged app ignores `FEEGA_NATIVE_CANVAS`, the workflow fails if `native/` is in the
app. The flag works only from source (`npm run start:native`). Reason: a user trial found the web overlay out of sync with the native
layer during pan/zoom, stuttering gestures, and camera drift after zoom. Fallback to web: addon fails to load, attach
fails, or `NATIVE_PROTOCOL` differs between the web app and the app's preload — the hosted app
deploys more often than the app releases. Bump both when the bridge commands change.

Measured on one real canvas, 6 s pan, M-series: native 119.8 fps / worst frame 25 ms, web
111.8 fps / 151 ms. The native worker still has 100–600 ms spikes on picture uploads (off the
page thread).
