# One contextual bottom bar; poster photos as elements

**Before.** Two toolbars: the canvas add bar slid away when a frame opened (#508) and the frame
drew its own floating draw toolbar bottom-left (#510). A selected poster line showed
`+ Photo` / `− Photo` / `Arrow` under its text (#526), although photos were already their own
selectable elements.

**Now.**

- `src/lib/canvas/bottom-bar.ts` is the one table: context (`Canvas` / `Frame`) → slots, whether
  the bar rides on the timeline, and which key region a click on it belongs to. The page derives
  the context from `CanvasState` (frame open = `Frame`). `CanvasAddBar` renders the slots from
  the table; a `{#key}` replays a short expo-out fade/slide on switch.
- Frame state shared between the shell and the bar lives in `frame-bar.svelte.ts` (draw tool,
  timeline height, host actions). The shell attaches only when `MOUNT[mount].tools` is
  `CanvasBar`; the standalone editor page keeps its own `DrawTools`.
- The bar sits at `z-index: 61`, above the inline editor layer (60): the frame stage otherwise
  swallowed clicks on it. Its `bottom` follows the timeline's measured height
  (`bind:clientHeight`), not `getBoundingClientRect` — the timeline slides in with a transform,
  so a rect read on open is off-screen.
- The frame slots carry `data-key-region="editor"`: a click on a tool would otherwise move the
  keyboard to the canvas and the shortcuts (V, ⇧T, ⇧R, ⇧O, ⇧P) would stop reaching the frame.
- Poster parts: `PART_OPS` in `poster-parts.ts` says what each part kind can do (line → insert
  photo; photo, arrow → delete). Delete key (`remove()` in the shell), the Properties trash and
  the right-click menu in `SelectionOverlay` all go through `runPart`. `removePhoto` drops the
  exact slot (its mark in its line and its media item). The lines editor (`MarkedLines`) keeps
  adding photos and arrows per line.

**Discarded.** Hiding the bar in frame context and keeping the floating toolbar (two places to
look); measuring the timeline's on-screen top (wrong during its slide-in).
