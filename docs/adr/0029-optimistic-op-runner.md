# 0029 — Canvas actions run through one optimistic op runner

Status: accepted 2026-10-29.

## Context

Product rule: no action waits for the server before the user sees its result. Each canvas
action had its own answer to that: some applied locally and rolled back by hand (delete, wire
mode), some applied locally and never rolled back (rename, ungroup), some waited for the answer
and then refreshed (move into a frame, wrap with stack, wrap in a section: 1.2–2.1 s on the
test account). Undo slots were pushed on the answer, so ⌘Z during a slow save missed the gesture.

## Decision

One runner, `createOptimistic` in `src/lib/canvas/optimistic-ops.ts`:

1. apply the change to local state, synchronously;
2. reserve the undo slot (`UndoStack.pushPending`, #1596);
3. hold snapshots off (`pending`) so a refresh cannot undo the local change;
4. send the write, serialised with every other op in the order they were made;
5. on success land the undo items and, if the action says so, refresh once the queue is idle;
6. on refusal or network error restore only the rows the op touched (`restoreRows`) from the
   state before it, land the slot empty, and show the action's notice.

Every action is a row in `REGISTRY` (`src/lib/canvas/optimistic-registry.ts`): local apply,
server fields, touched rows, landing test (`Moved` = `outcome === 'done'`, `Answered` = any
success), undo source, refresh. A new action is a row. State that is not canvas rows gets
its own registry run by the same runner: comment threads (`src/lib/canvas/comment-ops.ts`),
where an op touches thread ids instead of nodes/edges; the pages list and canvas share
(`src/lib/canvas/page-ops.ts`). Where the server would mint an id or token, the client mints
it and the server stores it, so nothing needs reconciling. Actions that change a frame doc
plan on the client with the same pure planner the server runs (`src/lib/motion/move-plan.ts`,
`src/lib/motion/scenes.ts`), seeded with client-chosen clip ids, and hold the planned docs
through `frameDocs.hold` until the op lands.

Optimistic concurrency is unchanged: writes that carry `nodes.version` keep sending it, a
`conflict` is a refusal (rolled back), and the server records it in `canvas_conflicts` (#1566),
so History can still offer "keep mine".

## Rejected

- **Snapshot rollback of the whole canvas**: it would erase edits made, or received by
  realtime, while the op was in flight. Only touched rows go back.
- **Per-action hand-written optimism**: that is what existed; it diverged action by action.
- **Folding the line queue (`op-queue.ts`) and the place/save schedulers in**: they already
  apply locally and retry offline from IndexedDB; the runner covers single-shot writes that
  do not retry. Runner ops are kept in the outbox `sent` list from the gesture to the answer and
  sent again after a reload (`src/lib/canvas/sent-ops.ts`); client-chosen ids make that safe.

## Amendment 2026-11-03 — every write is durable, not only placements

The runner was never the only write path. Element contents (frame-doc ops from
`FrameEditSession`) and draws were posted once, outside the outbox: lost offline, on a closed
tab, while the status said "Saved". Decision:

- **One outbox, more parts.** `feega-outbox` also keeps `draws` (an `op-queue` with
  client-minted node ids, replayed in order) and `docs` (`FrameDraft`: the ops from the last
  landed revision plus that revision, one per editing session, `src/lib/canvas/frame-drafts.ts`).
- **Idempotent on the server.** A draw resent with an id that exists answers that node. Frame ops
  are sets and add-if-missing, applied by `commitOps` on the current head from the sent version,
  so a replayed draft rebases instead of conflicting.
- **Unreachable is not refused.** A send that throws, 5xx or busy keeps the edit pending and
  retries with capped backoff; only a refusal drops it (and its draft).
- **A write waits for its node's draw.** Nothing naming a node reaches the server before the
  draw that creates it; snapshots keep the ghost of a queued draw.
- **One count.** The status and `beforeunload` read `pendingWrites` over every part, plus runner
  ops in flight.
- Server undo is kept in the `sent` log until answered; move undo is a placement write and does
  not wait for it.
