---
title: Native canvas on desktop
description: Draw the canvas with Metal in the macOS desktop app.
sidebar:
  order: 14
---

The macOS desktop app can draw the canvas with the same engine as the browser, compiled natively and running on Metal, instead of WebGPU. It is off by default; `FEEGA_NATIVE_CANVAS=1` turns it on.

```bash
cd apps/desktop
npm run build:native
FEEGA_URL=http://localhost:5199 FEEGA_NATIVE_CANVAS=1 npx electron .
```

Everything else (login, panels, chat, realtime) stays the web app. If the native module cannot load, or the window cannot create a Metal surface, the canvas falls back to the browser engine. It also falls back when the app's native engine and the web app speak different protocol versions, so an older app keeps working after a web deploy.

Known gaps: the selection overlay drifts from the native layer during pan and zoom, gestures stutter, the camera can drift after a zoom, the dot grid is hidden, a moving video re-uploads a still every frame, and macOS only.
