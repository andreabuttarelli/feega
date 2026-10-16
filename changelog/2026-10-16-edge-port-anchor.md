# Edges end on the port square, and follow ports that move

Two defects on canvas edges.

- **Stale anchors.** Changing a node's model adds or removes input ports, so the
  ports still there move to a new `top`. SvelteFlow measures handle positions
  once and never re-measured them: valid edges stayed on the old position.
  `CanvasTile` now calls `updateNodeInternals` whenever its port list changes —
  one effect, keyed on the ports it renders, not a call at every place that
  changes a model.
- **Gap before the port.** The port label lived inside the `<Handle>`, so the
  handle box (the edge anchor) included the label: when measured with the label
  visible, the edge stopped a label-width away from the square. The `<Handle>`
  is now only the 10px square; the label is a sibling positioned beside it. An
  `::after` with negative inset keeps the hit area generous without moving the
  anchor. The lit state uses an outline instead of growing the square, so its
  centre never shifts.

Test: `tests/e2e/canvas-edge-ports.spec.ts` (`@real`) checks both edge ends sit
within 2px of the port squares, before and after a model change shifts the
ports. It failed on the old code (76px off after the change).
