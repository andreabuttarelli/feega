# Desktop is Electron, mobile is Capacitor; the canvas goes native through gpu-core

Status: accepted 2026-10-25. Supersedes ADR 0009 for desktop; ADR 0018 stands for mobile.

## Decision

- **Desktop (macOS, Windows, Linux): Electron** shell in `apps/desktop` over the hosted app.
  Same routing as the Tauri shell it replaces: `FEEGA_URL` (default `https://oh.feega.app`),
  `FeegaNative/<version>` user agent, off-origin navigation to the system browser,
  `feega://auth/callback` → `<app>/auth/callback`, single instance.
- **Mobile (iOS, Android): Capacitor** (`apps/mobile`, ADR 0018).
- **One web UI** everywhere. No Flutter UI, no native screens.
- **Canvas native through gpu-core** (wgpu on Metal / Vulkan / DX12) under the web UI: an
  Electron native addon on desktop, a Capacitor plugin on mobile. JS owns the document and its
  ops; it hands gpu-core the display list (ADR 0020) and the viewport; pointer and gestures stay
  in the page. Frames reach the compositor zero-copy (IOSurface on Apple, shared handle elsewhere).

## Why

- Identical Chromium UI on every desktop: one engine to test, WebGPU present on all three.
- The native canvas removes the WebKit canvas risk that ADR 0009 left unmeasured.

## Cost accepted

~265–290 MB app, ~3x the memory of a system-WebView shell.

## Rejected

- Tauri: system WebView differs per OS (WKWebView, WebView2, WebKitGTK).
- Flutter UI: a second UI implementation.
