# A text inside a zero-width element no longer blanks the canvas

The "feega trailer" canvas opened empty: nodes flashed in and vanished, motion frames
never drew. One custom component (`.bottle:after{content:'LUMEN'}`) sat inside an
element scaled to `scaleX(0)` at the sampled time. `quartered` (`gpu-full/dom/read.ts`)
snaps glyph x to a quarter device pixel and divides by `m[0]`; `upright` checked `m[3]`
but not `m[0]`, so x became `0/0 = NaN`. `JSON.stringify` sent it as `null`, the gpu
core rejected the whole list (`invalid type: null, expected f64`), `CoreFrames`
treated that as a lost device and re-attached forever — the canvas painted once and
cleared. A selection repainted only the overlay, so a node "appeared on click".

Fix: `upright` also requires a non-zero `m[0]`; a collapsed axis keeps the raw x.
Guard: `gpu-full/dom/read.test.ts`. Introduced with snapping in eafa04d67; present on
every `dev` since, not tied to the shared-camera PR.

Not done: the core boundary still fails a whole list on one non-finite number.
