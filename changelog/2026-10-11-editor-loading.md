# /app prompt → motion editor: immediate feedback and a motion skeleton

**Why.** After sending the hero prompt nothing changed for ~0.8 s, then the infinite-canvas
placeholder showed before the motion editor: wrong shape, and no sign the click landed.

**Before.** `+layout.svelte` picked the entry shell inline: any `/p/...` target showed
`CanvasEntryShimmer`, including `/p/:p/c/:c/motion/:n`. The send button only disabled itself.

**What.**

- `src/lib/entry-shell.ts`: one table-like function `entryShell({from, to, signedIn})` →
  `None | App | Canvas | Motion`; the layout renders the matching shell.
- `MotionEntryShimmer.svelte`: bar, 16:9 stage, ruler + four tracks, chat column; phone drops the
  column. Sharp blocks, round only for icon dots and the pill; shimmer, none with reduced motion.
- `/app`: `brief-progress.ts` phases `creating your project…` (action pending) → `opening the
  editor…` (redirect received); textarea readonly and send disabled/pulsing while busy (no double
  submit). Focusing the prompt preloads the editor route chunk (`preloadCode`).

**Measured** (dev server, real stack, Playwright, warm; `~/Documents/feega-videos/editor-loading/`):

| | first feedback | editor visible |
|---|---|---|
| before desktop / mobile | 823 / 844 ms | 983 / 1185 ms |
| after desktop / mobile | 62 / 54 ms | 1083 / 1028 ms |

Time to editor is unchanged within noise; the wait is the `?/video` action (~0.5 s, `startMotion`)
plus the editor load. Discarded: parallelising `loadAttachments` with `startMotion` — only matters
with attachments, and the action is already one round trip.
