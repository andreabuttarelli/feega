# Layers shows frame elements on open

Report: on canvas open, Layers shows every frame as one closed block; the elements arrive seconds
later.

Measured with `tests/e2e/layers-open-fast.spec.ts` (10 frames, 5 of them posters, real stack, ms
after hydration including the click on Layers):

| | before | after |
|---|---|---|
| elements of all 10 frames | 1201 | 110–260 |
| parts of all 5 posters | 4744 | see below |

Second pass, every poster template (22) plus 5 videos on one canvas:

| | probe (before) | derived (after) |
|---|---|---|
| parts of 22 posters | 4070 ms, 22 probe players | 149–231 ms, 0 players |
| select a part with no player able to load | impossible (no row) | works |

Causes:

- Element rows came from one batched `frame-outlines` request, but only after the panel mounted.
  The canvas load now reads the same outlines (`canvasOutlines`, one `motion_revisions` query for
  every head) and publishes them with the canvas; the panel renders them at once and fetches only
  heads it does not hold.
- Poster parts were discovered by rendering each poster in a hidden player (`PartsProbe`). They
  are now derived on the server from the doc (`staticParts`, see ADR 0012): the built-in view runs
  against a DOM-less document and its `data-part` tags are read. The outline carries them, so
  Layers lists and selects parts with no player. The probe stays only for components that are not
  built-ins, and is never mounted when the outline names the parts.
- The open frame's outline is fetched again on each head, so its parts follow edits from data; the
  editor's measured parts only fill gaps.

Discarded: a hand-written `parts(props)` per template (a second definition that drifts from the
view); a `frame_elements` table (ADR 0012).
