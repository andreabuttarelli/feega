# Follow and spotlight on the canvas

The presence tick now also carries the tab's `view` (centre in canvas
units + zoom, so different screen sizes line up: `centreOf`) and a
`presenting` flag. Both default for marks from older tabs.

- Clicking an avatar follows that person: `followed()` picks their most
  recent tab's view and `CanvasFollow.svelte` centres the viewport on it.
  Any pan or zoom by hand (`onmovestart` with a user event) stops
  following; clicking the avatar again stops it too.
- "Spotlight me" sets `presenting`; everyone else gets "X is presenting ·
  Follow" until they follow.
- The view is read from SvelteFlow's store, not `onmove`, which did not
  fire for pan-on-scroll.
- The avatar row now shows when any other tab is here, including your own
  second tab.

e2e (`canvas-cursors.spec.ts`, two browser contexts): spotlight → follow →
the presenter scrolls → the follower's viewport moves.

GpuFlow needs the same `CanvasFollow`-style hook (report view, set
centre) when it lands.
