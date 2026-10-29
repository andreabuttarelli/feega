# Canvas no longer triggers back/forward swipe

- Horizontal trackpad pans on the canvas often fired the browser's back/forward swipe (macOS).
- Checked the passive-listener theory: Svelte 5 only makes touchstart/touchmove passive, so
  `preventDefault` in `onWheel` already works on the surface. Not the cause.
- Cause: nothing locked overscroll on the page, and wheel events outside the surface (panels,
  floating bars) reached the browser. `lockOverscroll` sets `overscroll-behavior: none` on
  html/body while `GpuFlow` is mounted and restores it on unmount; the surface has it too.
  Panels keep `contain`, so their own scrolling is unchanged.
