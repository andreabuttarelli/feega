# Canvas: a moving selection is carried, not re-sent

Marquee + move ran at 43–49 fps on a 48-node canvas copy and ~80 fps on the landings fixture. The
CPU profile put 41–45% of the main thread in `setOverlay`: `JSON.stringify`, UTF-8 encode, serde
parse and `put_group` in gpu-core. A probe on `TextEncoder.encode` during the drag showed the
**fixed** overlay part (every unselected label, 1.5 MB on the copy, 450 KB on landings) crossing
into wasm on every move, plus the selected part (190 KB).

Two causes:

- The chrome of a selected node's breakpoint views (`<id>@bp:<bp>`) was filed under the fixed
  part: they move with the node, so every move rebuilt and re-sent the whole fixed part.
  `ChromeOnCanvas.owner` now ties a view to its node, and a view of a selected node goes with the
  selection.
- The selected chrome itself was rebuilt and re-sent at its new place each move. It now lives in a
  fourth overlay part, `carried`, built once at the selection's rest position. While every
  selected tile has moved by the same offset (within 1e-6 world units) the items are kept and only
  the offset crosses: `carry_overlay(x, y)` in gpu-core moves the part's placement and damages
  where it was and where it lands. Wires touching the selection stay in the `selected` part and
  are rebuilt as before (they bend).

Draw order is unchanged: fixed, selected wires, carried chrome, live. The native bridge applies
the offset to the carried items' matrices before it sends the combined overlay.

Landings, move selection (production build, uncapped): per-move payloads 640 KB → 2 KB; the
`setOverlay` share of main-thread time 14–20% → below 1%. The remaining cost is Svelte's flush of
GpuFlow's drag graph (owned by the resize/drag work) and `frame()`.

Not done: hover or any change to one unselected node still re-sends the whole fixed part.
