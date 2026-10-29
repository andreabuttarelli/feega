# History panel

One left-rail panel, **History**, for everything that changed a canvas: who, when, what, and how
to go back. It replaces four entry points that today answer the same question in four places.
Decision record: [ADR 0024](../adr/0024-one-history-timeline.md).

## What the user sees

- A git-like graph, newest at top. **One lane per author**: each human user, the sidebar chat,
  each external MCP agent/client (`agent_key`). Each lane has its own colour and icon.
- **Node = a change**, grouped by session ("Claude Code: 12 changes to Landing"); expand to the
  single steps.
- **Concurrent edits** sit side by side on parallel lanes.
- **Conflicts** in red: two authors on the same element inside one window, or a write refused by
  optimistic concurrency (`nodes.version`). Action: *choose which to keep*.
- **Frame branches** drawn as real branches off the frame's lane, with *Merge* and *Drop*.
- Per node: **Preview** (canvas read-only at that point), **Revert this change**, **Restore to
  here**, **Name this version**.
- Filters: *AI only*, *People only*, *One frame*.
- AI change toasts stay small; click opens History focused on that change.

## Old entry point → new home

| Old | Where | New home |
|---|---|---|
| AI-changes button + popover (`AgentChangesPanel.svelte`, "mcp changed … Reject") | canvas page | History, AI filter; *Revert this change* |
| "Versions…" | `CanvasTopBar.svelte` | History, named nodes; *Name this version* / *Restore to here* |
| "Version history…" (`frame-history`) | `selection-actions.ts`, `FrameDialogs.svelte` | History, *One frame* filter |
| "Branches…" (`frame-branches`) | `selection-actions.ts` | History, branch lanes; Merge / Drop |

Each old entry point is removed in the slice that ships its replacement.

## What exists

| Piece | Where | State |
|---|---|---|
| Structural audit log `canvas_events` (`node.create/update/delete`, `edge.create/delete`, `before`/`after`, `actor_kind`, `actor_id`, `agent_key`) | `src/lib/server/repos/canvas-events.ts`, written by `repos/canvas.ts` | Exists. Moves are **not** logged (`nodes.x/y` last-write-wins). |
| Optimistic concurrency on `nodes.data` | `repos/canvas.ts` (`where version = expected` → `{ outcome: 'conflict' }`, batch variant with `keys`) | Exists. **The refusal is recorded nowhere**: returned to the caller and lost. |
| Agent-change grouping | `agentChanges()` in `src/lib/canvas/undo-last.ts`: agent-only, same writer, ≤1.5 s gap | Exists; a "gesture", not a session. Humans skipped. |
| AgentChangesPanel data source | page action `agent_changes` → `listAgentChanges` (`src/lib/server/canvas/reject.ts`), last 200 events | Exists. |
| Selective revert | page action `reject_change` → `reject.ts`: reverts only fields the change touched; field edited since = conflict resolved with `choices`; created node connected by someone else needs `confirm` | Exists; the rule this spec generalises. |
| Canvas versions | `canvas_versions` (named full snapshot, actor columns), `src/lib/server/canvas/canvas-versions.ts`; ops `save_/list_/restore_canvas_version` (restore saves the moment before) | Exists. |
| Motion revisions | `motion_revisions`, `src/lib/server/repos/motion-revisions.ts` (heads, checkpoints sealed per editing session, list limit 30, names); frame-editor ops `list_revisions`, `name_revision`, `restore_revision` | Exists, per frame. |
| Frame branches | `src/lib/server/motion/branches.ts`, `branch-store.ts`, `$lib/motion/branch-merge` (diff, conflicts, choices); ops `create_/list_/review_/merge_/drop_branch` | Exists. |
| Realtime | `nodes`, `nodes_connections`, `canvases`, `node_runs` published | `canvas_events`, `canvas_versions`, `motion_revisions` **not** published. |
| Client undo | per-tab stack (`$lib/canvas/undo-plan.ts`), server `undo` action | Exists; unaffected. |

## What is missing

1. **One timeline read.** Nothing merges `canvas_events`, `motion_revisions`, `canvas_versions`
   and branches into one ordered list with authors.
2. **Sessions.** No `session_id` on events. Grouping is a 1.5 s heuristic, agents only. Session
   key: MCP/CLI = one per agent turn/connection; sidebar chat = chat turn; human = idle gap per
   user per canvas (same idea as motion checkpoints).
3. **Recorded conflicts.** A refused write leaves no trace (below).
4. **Concurrent-edit detection.** Two authors on the same `node_id` within a window is never
   computed.
5. **Preview at a point.** No reconstruction of canvas state at event N; only full snapshots in
   `canvas_versions`.
6. **Revert for human changes and motion revisions** under the same rule as `reject_change`.
7. **Realtime** for the timeline.
8. **AI toast** linking to the panel: none found today.
9. **CLI/MCP**: no `/api/v1` history endpoint or CLI command; `agent_changes`/`reject_change`
   exist only as page/edit ops.

## Recording refused writes

New table `canvas_conflicts` (org-scoped, RLS via `auth_org_ids()`):

| Column | Meaning |
|---|---|
| `id`, `org_id`, `canvas_id`, `node_id` | where |
| `expected_version`, `actual_version` | what the writer believed vs. what was there |
| `attempted` jsonb | the refused patch, enough to re-apply |
| `winner_event_id` | `canvas_events` row holding the current value, if known |
| `actor_kind`, `actor_id`, `agent_key`, `session_id` | who was refused |
| `resolution` (`open` / `kept_theirs` / `kept_mine`), `resolved_by`, `resolved_at` | outcome |
| `created_at` | when |

Written by `repos/canvas.ts` on every conflict outcome, and by the motion head commit on version
mismatch. *Keep mine* re-applies `attempted` against the current version as a new event; *keep
theirs* only closes the row.

## Selective revert rules

Reverting change C (any author):

1. **Safe** when no later event touches the same element (`node_id`/`edge_id`), or for
   `node.update` the same top-level `data` keys. Apply the inverse directly.
2. **Warn** when a later change touched the same element: list them; user picks per field
   (`choices`, as `reject_change`) or cancels.
3. **Confirm** when C created a node others since connected or edited: reverting removes their
   work too.
4. A revert is a change on the reverter's lane, linked to C, and can itself be reverted.
5. **Restore to here** saves the current state as a version first, then applies. Never
   destructive.

## MCP / CLI parity (app → CLI → MCP)

| App | `/api/v1` | CLI | MCP op |
|---|---|---|---|
| list timeline (author kind, agent, frame, since) | `GET /api/v1/canvas/{id}/history` | `feega history <canvasId> [--ai\|--people] [--frame <id>]` | `list_history` |
| revert change | `POST …/history/{changeId}/revert` | `feega history revert <changeId> [--keep <field>=mine\|theirs] [--confirm]` | `revert_change` (replaces `reject_change`) |
| restore to point | `POST …/history/{changeId}/restore` | `feega history restore <changeId>` | `restore_to` |
| name version | `POST …/history/{changeId}/name` | `feega history name <changeId> "<name>"` | `name_version` |
| resolve conflict | `POST …/conflicts/{id}/resolve` | `feega history resolve <id> mine\|theirs` | `resolve_conflict` |
| branches | existing branch ops | `feega history branches <frameId>` | existing `*_branch` ops |

`agent_changes`, canvas-version ops and `list_/restore_revision` fold into these; removed ops
leave CLI, MCP and docs together.

## Out of scope

Move history (positions stay unlogged), cross-canvas history, retention changes.
