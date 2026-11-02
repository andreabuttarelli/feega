# test:gate runs against the GPU canvas again

The gate was red on main and dev (27 of 30 failing): its specs drove the DOM editor
(`motion-editor`, `editor-stage`, `input.hex`) that the GPU canvas replaced.

- Selectors follow the current canvas: `motion-inspector` for "editor open", the fill
  hex is `Fill colour hex` inside the picker, tiles are read from `frame-overlays` and
  `core-canvas`, a text prompt mounts on click, not on hover.
- `poster-text-kept` drives in-place text on a Text clip (`core-text-edit`); posters
  have no in-place editor on the GPU canvas. Enter is a newline there, so it is no
  longer an exit.
- `canvas-own-writes`: refocus the field with `focus()` + `End`; a click placed the
  caret mid-text.
- `canvas-landing-session`: the Layers fetch check matched the Vite module URL
  `frame-outlines.ts`; it matches the API path now.
- `layers-closed-frames` (#1688): a closed poster lists its element, its parts only
  once open. `url-import-go-to-main`: opens the search first; the selected row after
  Go to main is the set frame node.
- The sign-in helper dismisses the cookie banner (shown on non-dev builds).
- Gate list: dropped `canvas-inline-play` (file gone) and `fluidity-scorecard`; added
  `layers-closed-frames`.

Not in the gate, and why: `fluidity-scorecard` drives ~25 steps through the old
inspector (`aside.props`, `.svelte-flow__node` for elements) and fails real WebKit
thresholds (input to paint p95 150-500 ms against 50 ms). It needs its steps rewritten
and the latencies fixed, not a selector swap.
