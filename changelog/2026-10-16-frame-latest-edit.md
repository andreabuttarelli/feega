# Frame tiles show the editor's local doc

**Before.** The tile drew a server poster or a player fetched at `docHeadRevision`, which only moves on
realtime/snapshot and lags the editor's `version`. #682 kept the last decoded poster of any revision, so
after a recolour the tile flashed the previous colour (23/84 red samples). Closing also remounted
`InlineMotionEditor`: `leave()` ran in an effect after the `{#key}` block had already dropped the
editor, the session cache had been `take`n, and the remount showed "Opening the editor…".

**Now.**
- `src/lib/canvas/frame-docs.svelte.ts`: one local doc per frame (`version`, baked html, size). The
  shell publishes it on every committed change; `sending`/`landed` keep it valid while the own save's
  realtime echo outruns the HTTP reply. A server head newer than the store wins (peer edits).
- `MotionNode`: with a local doc the tile renders live from it — no fetch, no capture, no poster.
  A poster is shown only for the current revision, never a leftover one.
- Canvas page: `selectionChanged` calls `inlineStage.leave` synchronously, so the editor stays mounted
  until the tile has drawn.

**Discarded.** Keeping the tile player mounted under the editor while editing: it doubles the players
the inline spec caps at one per edited frame.
