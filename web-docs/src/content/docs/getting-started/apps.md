---
title: Apps
description: feega on iPhone, iPad, Android, macOS, Windows and Linux.
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
| macOS, Windows, Linux | [Download](https://github.com/andreabuttarelli/feega/releases/tag/desktop-latest) from GitHub Releases |

**Signing in.** Google and GitHub open in your system browser and return to the app.

**Files.** Drag images, SVG and `.feega` files onto the canvas, or use the upload button. Exports save through the system dialog.

**Touch.** Pinch to zoom, two fingers to pan.

## Desktop

Download from [GitHub Releases](https://github.com/andreabuttarelli/feega/releases/tag/desktop-latest):

| OS | File |
|---|---|
| macOS, Apple silicon | `feega-<version>-mac-arm64.dmg` |
| macOS, Intel | `feega-<version>-mac-x64.dmg` |
| Windows | `feega-<version>-win-x64.exe` |
| Linux | `feega-<version>-linux-x86_64.AppImage` or `.deb` |

Unsigned builds: on macOS right-click the app → Open the first time; on Windows SmartScreen → More info → Run anyway.

**Window.** No title bar: the window controls sit over the app's top edge, which drags the window. Cmd/Ctrl+W closes, Cmd+M minimises, Cmd/Ctrl+Q quits.

**Updates.** The app checks on launch and every 4 hours, downloads in the background and asks to restart. On macOS this works only for signed builds; Windows and the Linux AppImage update unsigned. The `.deb` does not self-update.

### Releasing (maintainers)

Push a tag `desktop-v<version>` (e.g. `desktop-v0.2.0`). The *Desktop release* workflow builds macOS (arm64 + x64), Windows and Linux, attaches the files to the `desktop-v<version>` release and to the `desktop-latest` release the app updates from.

macOS signing and notarisation run only when these repository secrets exist; otherwise the build is unsigned:

| Secret | What |
|---|---|
| `CSC_LINK` | Developer ID Application certificate, `.p12` exported from Keychain, base64 |
| `CSC_KEY_PASSWORD` | the `.p12` password |
| `APPLE_ID` | Apple ID email of the developer account |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-character team id from developer.apple.com → Membership |
