---
title: Phone frame preview in Feega Inspect
description: Preview your app inside an iPhone, Pixel or iPad frame and edit it there. Works for Capacitor, Ionic and Tauri apps.
sidebar:
  order: 5
---

Feega Inspect can show your running app inside a device frame, with the notch and the safe areas
of a real phone. Selecting and editing work in the frame as on any other size.

## Pick a device

Open the arrow at the end of the device bar and choose one under **Device frames**:

- iPhone 15, 393 × 852
- iPhone SE, 375 × 667
- Pixel 8, 412 × 915
- iPad, 820 × 1180

The app renders at the device's CSS size and the frame is scaled down to fit the panel. The
percentage next to the device bar shows the scale.

## Rotate

The rotate button in the device bar switches between portrait and landscape. The notch moves to
the side and the safe areas follow.

## Safe areas

The hatched bands show the top, bottom and side insets of the device (the status bar, the home
indicator, the notch). Keep your content inside them with `env(safe-area-inset-*)`.

## Capacitor, Ionic and Tauri

The UI of a Capacitor, Ionic or Tauri app is a web page served by a dev server. Open that
project in your editor, start Feega Inspect and pick a device. Native plugins, such as the
camera, do not run in the preview.

The width of the frame is also the width Feega Inspect uses to choose the breakpoint an edit is
written to. See [Responsive editing](/integrations/inspect-responsive/).
