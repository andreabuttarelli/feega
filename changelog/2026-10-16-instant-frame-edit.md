# Instant frame editing on the canvas

Opening a frame already stayed on the canvas (inline editor, no route change), but it showed
"Opening the editor…" until `/session` answered, then waited for the player iframe to measure
clip boxes before drawing a selection. Measured on a one-box frame (first pointerdown →
selection box): 509 ms desktop, 756 ms phone at 4x CPU, loading banner on both.

- The session is prefetched for the canvas's motion nodes shortly after they load, and on
  hover; `earlyFetch.settled` hands a landed session over synchronously, so the editor mounts
  in the same frame as the click.
- `SelectionOverlay` starts from `guessedBoxes(doc)` (box from each laid-out clip's props) and
  drills on mount; the player's measurement replaces it when it answers.

After: 54 ms desktop, 250 ms throttled phone, no loading state. Spec:
`tests/e2e/canvas-instant-frame-edit.spec.ts`.

Discarded: polling sessions to keep them fresh (server load per idle canvas). A session older
than 15 s is still refetched; hover re-warms it.
