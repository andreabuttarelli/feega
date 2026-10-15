# Layers shows frame elements on open

Report: on canvas open, Layers shows every frame as one closed block; the elements arrive seconds
later.

Measured with `tests/e2e/layers-open-fast.spec.ts` (10 frames, 5 of them posters, real stack, ms
after hydration including the click on Layers):

| | before | after |
|---|---|---|
| elements of all 10 frames | 1201 | 110–260 |
| parts of all 5 posters | 4744 | 1600–1900 |

Causes:

- Element rows came from one batched `frame-outlines` request, but only after the panel mounted.
  The canvas load now reads the same outlines (`canvasOutlines`, one `motion_revisions` query for
  every head) and publishes them with the canvas; the panel renders them at once and fetches only
  heads it does not hold.
- Poster parts need a rendered player to be measured (`PartsProbe`). Probes ran one at a time and
  polled `measure()` blind, burning a 1 s timeout per try while the player loaded. Four probes now
  run together, and each measures on the player's first redraw (fallback after 1.5 s).

Discarded: deriving part ids from the doc without rendering — they come from the component's DOM.
