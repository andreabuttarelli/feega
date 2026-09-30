# Typing in a node no longer loses focus or rolls back

**Why.** Production report: typing fast in a text node or a prompt froze
for a moment every few seconds and the text came out mangled.

**Cause, two defects.**
1. `syncNodes` (`src/lib/canvas/tile-sync.ts`) rebuilt every SvelteFlow node
   from `toNode` whenever any tile changed (a peer move, the text node
   growing a line). The rebuilt nodes had no `measured`, so xyflow hid them
   (`visibility: hidden`) until re-measured: the focused textarea blurred,
   keystrokes went to the canvas. Now only nodes that differ are replaced,
   merged over the old object so `measured` survives; the rest keep identity.
2. The canvas page `$effect` that loads tiles and opens realtime read the
   whole `data` prop. A layout invalidation (`app:canvases` after a
   resync, a `canvases` realtime event, `app:credits`) re-ran it: tiles reset
   to the page-load rows and realtime reconnected, which could resync again.
   It now depends only on `data.nodes` (`canvasLoad`), i.e. a real page load.

**Tests.** Two unit cases in `tile-sync.test.ts`; `tests/e2e/fast-typing.spec.ts`
(`@real`): peer edit + reveal mid-typing keeps text and focus; two tabs see
each other's edits.
