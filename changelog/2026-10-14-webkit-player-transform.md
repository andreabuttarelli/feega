# iPhone player: no CSS zoom on WebKit

On iOS Safari the motion editor player showed a black frame: the composition was cropped to its
top-left corner (Saturn at 00:07 was only space and stars). `keepCrisp` (2e866c45) swaps the
player's `transform: scale()` for CSS `zoom` on the iframe so Chromium rasterises text at display
size. iOS shrinks the zoomed box but lays the frame out unzoomed.

`crispFor(engine, frame)` keeps the zoom path for Chromium only; WebKit keeps the player's
transform. Desktop WebKit under Playwright propagates the zoom correctly, so it cannot show the
crop: the WebKit e2e (`canvas-motion-webgl.spec.ts`, project `webkit-iphone`, real stack only)
asserts the whole three.js frame is drawn and that the iframe carries no zoom. Discarded: sizing
components from the composition instead of `root.clientWidth` — the crop happens with any
content, not only WebGL.
