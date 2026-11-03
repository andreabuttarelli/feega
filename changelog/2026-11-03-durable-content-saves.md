# Element contents and draws go through the durable outbox

Durability audit round 2 (`~/Documents/feega-videos/audit/round2/durability/`, s2/s4/s6) found
that only placements, node patches and lines were durable. Everything else was lost while the
status said "Saved".

- **Before.** Content edits (fill, text, anything inside a frame) went through
  `FrameEditSession.save` → `?/ops` once. Offline the fetch threw, the session stayed `saving`
  forever and every later edit only set `resave`. Nothing was persisted, nothing retried,
  nothing counted in the status or `beforeunload`. Draws (`drawElement`, `drawFrame`) were
  posted once; offline the ghost was removed. s2: 5/5 fills and 5/5 offline shapes lost.
  s4 (1.5 s latency, close mid-save): created shape and both fills lost. s6c: quick
  undo/redo/undo then reload lost the last undo, because `applyMoveUndo` awaited the server
  save inside the history turn, so the last ⌘Z was never applied before the reload.
- **Content.** The session now catches a thrown send and treats network/5xx/busy as
  `Delivery.Unreachable`: it stays `Pending` and retries with capped backoff (1 s → 30 s), and
  the GPU canvas flushes all sessions on `online`. Every edit, undo and redo hands the host a
  `FrameDraft` (`version` + ops from the last landed revision); the page keeps them in the
  outbox `docs` part (`frame-drafts.ts`) and, after a reload, replays the ones left once the
  draws have landed. Ops are idempotent (sets, add-if-missing) and the server rebases from the
  sent version, so a replay of an already-landed draft is harmless. A refused save clears its
  draft: it would be refused again.
- **Draws.** A second `createOpQueue` (`draws`, outbox part `draws`) with client ids. The ghost
  stays through offline and through snapshots (`keepDrawn`); after a reload ghosts are rebuilt
  from the queued wire. Any write naming a node waits for that node's draw, so a move or fill
  never reaches the server before the shape exists. Server `drawElement`/`drawFrame` answer a
  repeated id with the existing node (`madeBefore`), instead of a duplicate insert.
- **Status.** `pendingWrites` counts patches, placements, lines, draws, content drafts and
  runner ops in flight; `warnUnsent` uses the same count.
- **Undo.** Move undo no longer awaits the save (it is already in the placement outbox).
  Server undo is kept in the `sent` log from the keypress to the answer, so a reload replays it.
- **Discarded.** Folding content into `createSaveScheduler` (it merges flat patches; content is
  op lists relative to a revision). Persisting whole docs instead of ops (large, and loses the
  rebase the server already does).
- **Known gap.** An undo slot for a draw waits for the draw to land: ⌘Z while that draw is still
  queued offline waits too.

ADR: `docs/adr/0029-optimistic-op-runner.md` (amended).
