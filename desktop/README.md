# Feega desktop

Electron app around the `npx feega` launcher. One tab per folder: each tab runs the bundled launcher and shows its editor.

## Develop

```bash
npx svelte-kit sync
npm --prefix npx run build
cd desktop
npm install
npm run dev
```

Tests, from the repo root: `npx vitest run --root . --dir desktop desktop/src`.

## Start a project

The welcome screen scaffolds a project with `cli/lib/scaffold` (bundled files plus library sections), runs `npm install`, then opens it. The login-shell `PATH` is read at start and Node.js is checked before any tab opens.

## Package

```bash
npm run dist
```

Output goes to `release/`. The launcher (`npx/dist`) is copied into the app as `Resources/npx`, so no global `npx feega` is needed.

| Platform | Files |
|---|---|
| macOS | `Feega-mac-arm64.dmg`, `Feega-mac-arm64.zip`, `Feega-mac-x64.dmg`, `Feega-mac-x64.zip` |
| Linux | `Feega-linux-x64.AppImage` |
| Windows | `Feega-win-x64.exe` |

Packaging settings live in `electron-builder.config.cjs`.

## Release

`.github/workflows/desktop-release.yml` builds all targets on a `desktop-v*` tag or a manual run with `publish` on, and uploads them to the `desktop-latest` release plus a release named after the tag.

macOS builds are unsigned (ad-hoc) until these repository secrets exist:

| Secret | Meaning |
|---|---|
| `MAC_CSC_LINK` | Developer ID Application certificate, base64 `.p12` |
| `MAC_CSC_KEY_PASSWORD` | Password of the `.p12` |
| `APPLE_ID` | Apple ID used to notarize |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password of that Apple ID |
| `APPLE_TEAM_ID` | Team ID |

With `MAC_CSC_LINK` set the app is signed with the hardened runtime. With `APPLE_TEAM_ID` also set it is notarized.

## Sign in

The app opens `https://oh.feega.app/cli/callback` with a loopback port and a `desktop.` state. The page posts the session to `http://127.0.0.1:<port>/session`, or opens `feega://signin` when the browser blocks loopback. The account is stored with `safeStorage`.
