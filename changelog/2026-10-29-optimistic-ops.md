# Canvas actions run through one optimistic runner

Rule (user, 2026-10-29): no action waits for the server before the user sees the result.
Mechanism: `createOptimistic` (`src/lib/canvas/optimistic-ops.ts`) + one row per action in
`REGISTRY` (`src/lib/canvas/optimistic-registry.ts`). ADR 0029. Rule in CLAUDE.md.

Converted in this slice: move a free element into a frame, wrap with stack, wrap in a section,
group, ungroup, bring to front/back, rename, wire mode, delete. `regroup()` is gone.

Before, per action: delete and wire mode had hand-written rollback; rename and ungroup applied
locally with no rollback; restack rolled back by refetching; delete pushed its undo only after
the answer, so ⌘Z during the save missed it. Now every row reserves the undo slot at apply and
rolls back only the rows it touched.

## Audit (test@dazero.co, local dev → production DB, time from key/pointer-up to the DOM change)

| Action | Before | After (server delayed 2 s) | Path |
|---|---|---|---|
| Move free element into frame | 1250 ms (74 frames) | 21 ms (1 frame) | runner |
| Wrap with stack (free) | 1220 ms (74 frames) | 76 ms (2 frames) | runner |
| Wrap in a section | 2129 ms (128 frames) | 26 ms (1 frame) | runner |
| Delete | 12 ms | 13 ms | runner (undo no longer waits) |
| Group | 9 ms | 17 ms (2 frames) | runner (adds rollback) |
| Bring to front | 7 ms | 1 ms | runner (adds rollback) |
| Ungroup, rename, wire mode | local already | local | runner (adds rollback) |

Still waiting for the server (not converted, by code reading):

- Move an element out of a frame (`moveElement`), place a component (`placeComponent`), paste
  copied elements (`copyElement`/`copyFree`), insert scene, combine scenes, layers to frame:
  `landed()` — the result exists only after the server writes the frame doc; optimism needs a
  local frame-doc edit.
- Connect to a motion frame (`connect` on a motion target), comments (add/reply/edit/delete/
  resolve: each awaits, then reloads the thread list), frame resize (`frameSize`), group scale
  (`scaleGroup`), restore a run (`restore`), share, page create/rename/delete
  (`submitCanvasAction` + `invalidate`), uploads.
- Paste of nodes, duplicate, draw tools, templates: owned by the insert/duplicate work.
- Already local: node moves/resizes (`places`), node data (`saves`), lines (`op-queue`), frame
  edits (`FrameEditSession`: hide, lock, component, detach, reorder inside a frame), model
  and settings (`batchWrite`, local first; conflict refreshes).
- Generations and exports wait by nature (they produce a result the client cannot guess).

Not done: runner ops are not persisted to IndexedDB like lines and places; a reload mid-save
loses them.
