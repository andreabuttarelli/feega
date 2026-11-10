---
title: Apps
description: feega on iPhone, iPad, Android and macOS.
sidebar:
  order: 4
---

The apps run the same feega you use in the browser: same canvas, same account, same files. Nothing to sync.

| Platform | Status |
|---|---|
| Web | [feega.app](https://feega.app), any recent browser |
| Install as app | Chrome or Edge: install icon in the address bar. Safari: Share → Add to Dock / Add to Home Screen |
| iPhone, iPad | Preview, not yet on the App Store |
| Android | Preview, not yet on Google Play |
| macOS | [Download](https://github.com/andreabuttarelli/feega/releases?q=desktop-v&expanded=true), then follow the [install guide](/desktop/install-macos/) |

**Signing in.** Google and GitHub open in your system browser and return to the app.

**Files.** Drag images, SVG and `.feega` files onto the canvas, or use the upload button. Exports save through the system dialog.

**Touch.** Pinch to zoom, two fingers to pan.

## Desktop

The macOS app runs feega in local mode: no account, one canvas per `.feega` file.
Install it with the [macOS install guide](/desktop/install-macos/), which covers the
first-open confirmation the unsigned app needs and how to check the download.

| OS | File |
|---|---|
| macOS, Apple silicon | `feega-<version>-mac-arm64.dmg` |
| macOS, Intel | `feega-<version>-mac-x64.dmg` |

Windows and Linux builds are not published right now.

**Window.** No title bar: the window controls sit over the app's top edge, which drags the window. Cmd+W closes, Cmd+M minimises, Cmd+Q quits.

**Updates.** The app checks for a newer release on launch and every 4 hours and offers to open its download page. Replace the app by dragging the new one to Applications.

### Releasing (maintainers)

Push a tag `desktop-v<version>` (e.g. `desktop-v0.2.0`). The *Desktop release* workflow builds the macOS app for arm64 and x64 on a macOS runner, ad-hoc signs it, and attaches the `.dmg`, `.zip` and `SHA256SUMS.txt` to the `desktop-v<version>` release. No Apple secrets are used.
