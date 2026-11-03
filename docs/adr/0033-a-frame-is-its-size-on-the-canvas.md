# 0033 — A frame is its size on the canvas

Status: accepted 2026-11-02. Extends [0032](0032-a-free-element-is-its-node.md).

## Context

0032 made a free element read in canvas px and kept drawn frames at two doc px per canvas px "for
export". The inspector then read a frame and its layers in doc px while X/Y were canvas px: a
700×460 frame showed Frame size 1400×920, a 160 px rect W 320, a radius of 12 drew 6 px. Frames
from a preset format are worse still: a 1920×1080 doc in a 420 px node. Doc px per canvas px was
never one number: drawn 2, hand-resized 1 (a handle drag re-stages the doc at the node size),
preset ~4.6.

Figma: a frame's size is design units; resolution is chosen at export (1×, 2×, 3×…).

## Decision

1. **Design units are canvas px.** A frame's size is its node box. `scaleOf(doc, node)` in
   `src/lib/motion/units.ts` is canvas px per doc px; `spaceOf(doc, scale)` is the stage every px
   field of the inspector converts through (frame surface, layers, multi-selection, camera,
   animate-to). It is the single conversion point of 0032, now fed with the node box for every
   node, not only free elements. Old docs are not rewritten.
2. **New frames are drawn one doc px per canvas px**, as elements and hand-resized frames already
   were (`DOC_PX_PER_CANVAS_PX`, `draw-create.ts`). For them the factor is 1, so agents, MCP and
   the inspector read the same numbers.
3. **Frame size edits the node.** W, H and presets resize the node through the same path as a
   handle drag (`NodePlace.resize` → `onResize`), so the doc follows at one px per canvas px.
4. **Image export scale is of the design size.** `rowSize` takes the design size
   (`doc × docScale`); the page or SVG is drawn at `row scale × docScale`. `docScale` comes from
   the node record on the server (`docScaleOf`, `editor.ts`) for `export_selection` and the still
   export. The dialogs, `feega canvas export` and the still dialog start at 2×, so a legacy 2×
   frame exports exactly as before and a new 1× frame as sharp.
5. **Video keeps its resolution.** MP4 already picks a short side (720p–4K) independent of the
   doc; the browser render now scales up to it like the farm (`exportSize` = `outputSize`, no
   cap at the doc size), so 1× docs render as sharp as 2× ones did.
6. **Resizing a frame keeps what is inside it.** A resize (handle or typed) keeps the doc px per
   canvas px the frame had (`densityKept`, `custom-size.ts`), applies constraints, and holds type
   size, strokes and corner radius in px (`heldPixels` for every frame, not only stills, plus
   `heldRadii`: roundness is a share of a layer's short side, so a stretched surface grew from 12
   to 92 px). Typing W on an auto-width text makes it fixed width
   (`resizedTexts`, now run on every inspector edit). Wrapping a text in a stack keeps its sizing
   (`TEXT_ITEM`, shared with the Figma import).
7. **A library text style is px.** The project library holds `sizePx`; a doc holds the share of
   its own short side. `inLibrary`/`inDoc` (`style-library.ts`) are the only conversions, so a 16
   px style is 16 px in a phone and in a 52 px button. Legacy library entries with `size` keep
   their share until edited.
8. **The motion agent speaks doc px.** Its session has no node box and its sizing is tuned to the
   composition; for new frames doc px are canvas px. `export_image` stays relative to the doc.

## Rejected

- Keeping drawn frames at 2× and converting at every agent tool: ~30 conversion sites in
  `motion-tools.ts` without a node box, and agent sizing would shift on every legacy frame.
- Rescaling old docs to 1× on open (same reason as 0032).
- A separate 1×/2× control for MP4: the resolution control already is the video's scale.
- Defaulting export to each frame's native density: one more rule; 2× covers the frames people
  draw. A preset frame denser than 2× exports smaller at 2× than its old 1×; pick 4× or a width.
