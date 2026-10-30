# History 1: one timeline read and a read-only panel (#1547)

Spec `docs/specs/history-panel.md`, ADR 0024. First slice: read only.

- `readHistory` (`src/lib/server/canvas/history.ts`) merges `canvas_events`,
  `canvas_versions`, `motion_revisions` of the canvas frames, and branches
  (version 1 of a branch node) into one list. No new table, no migration.
- Lanes and filters live in one model, `src/lib/canvas/history/timeline.ts`:
  `LANE_OF_AUTHOR` (actor kind → lane kind, `sidebar` agent key → chat),
  `LANE_RULES` (key, label, icon per lane kind), `FILTER_LANES`
  (all/ai/people), `ENTRY_VERBS` (one row per entry kind). Later slices add
  rows, not ifs.
- Entry points: `GET /api/v1/canvas/{id}/history`, view op `list_history`
  (MCP), `feega history <canvasId> [--ai|--people] [--frame]`, and the
  History rail panel (`Alt+6`) reading `/p/{project}/c/{canvas}/history`.
- `canvas_versions` reads now select the actor columns.
- Not yet: sessions (`session_id`), conflicts, revert/restore/name, realtime;
  the old entry points stay until their slices land.
