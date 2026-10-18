# Follow works on the GPU canvas

Follow/spotlight broke once the GPU canvas became the default: `GpuFlow`
ignored `follow`, `onView` and `onUserPan`, which only the DOM canvas
(`CanvasFollow.svelte`) implemented. The presenter never sent its view and
the follower never moved.

`GpuFlow` now reports its view on every change (`centreOf`), centres on a
followed view (`viewportCentredOn`, the inverse, tested), and stops
following on any pan, pinch or wheel by hand. The spotlight e2e runs on
both renderers (`?renderer=dom` and the default).
