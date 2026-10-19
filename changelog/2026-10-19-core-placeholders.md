# Core canvas: placeholders instead of holes

Without Pixi, a node the core had not loaded was not drawn: on the heavy canvas (iPhone, 20 s)
most cards and half the frames were missing.

Every core node now has layers, best first: whole frame or full card → card with pending/failed
pictures as blocks (`withoutPictures`) → blank card (`blankCard`). `choose` draws the best layer
already uploaded, spending at most 6 uploads per paint on nodes nearest the viewport centre;
frame sources load nearest-first, 4 at a time. The swap happens inside one paint: no flicker.
`postersFor` is gone: a poster is a lower layer of the motion node.

Cards whose media resolves Partial now show with only the missing pictures blocked.

Cards over the texture budget (`resident`) stay on the bare layer: blocks, not holes. On the heavy
canvas that is 42 cards on desktop, 21 on iPhone — the byte estimate (`images × list area`) is
pessimistic and worth revisiting.

`scripts/bench/canvas-core.ts` reports `coveredMs` (renderer up → no visible node undrawn),
`holesAt1s`, `standingIn`. Heavy copy: Chrome 4 ms / 0 holes, WebKit iPhone 521 ms / 0.
