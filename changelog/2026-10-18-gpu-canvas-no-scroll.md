# GPU canvas: the wrap can no longer scroll

Seen by the fluidity scorecard on the heavy canvas (Chromium and WebKit, intermittent): right
after picking a draw tool the whole canvas went blank, the grid showed only in a top strip and
the add bar jumped to the top-left. The `.wrap.svelte-flow` element of `GpuFlow` had
`scrollTop 811 / scrollLeft 495`: `overflow: hidden` still lets focus or `scrollIntoView` scroll a
box, and the wrap holds the canvas, the node overlays and the bar.

`overflow: clip` makes the wrap unscrollable. Guard: `gpu-canvas-no-scroll.spec.ts` focuses and
scrolls to an element far outside the view and asserts the wrap stays at 0,0 and the bar in place
(red before, green after, Chromium and WebKit). The exact element the app focused was not caught in
a repro; the fix closes the mechanism, whatever focuses.
