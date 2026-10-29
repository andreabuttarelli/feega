# History 5: preview, restore, name; Versions dialogs retired (#1551)

Spec `docs/specs/history-panel.md`, ADR 0024.

- `SOURCE_ACTIONS` in `timeline.ts` says what each entry source offers
  (version: preview/restore; revision: preview/restore/name; events and
  branches: none yet). `entryRef` parses entry ids back.
- `history-actions.ts` maps source → handler (`HANDLERS`), reusing
  `restoreCanvasVersion` (saves "Before restoring …" first), `restoreRevision`
  (new head, history kept) and `nameVersion`.
- Entry points: panel row actions + "Save version" button →
  `/p/{p}/c/{c}/history/{entryId}` (GET preview, POST restore|name);
  `/api/v1/canvas/{id}/history/{entryId}/{preview|restore|name}` → canvas ops
  `preview_at`, `restore_to`, `name_version`; `feega history <canvasId>
  --preview|--restore|--name <entryId> [--as]`.
- Removed: `CanvasVersionsDialog`, Pages-menu "Versions…" (now "History"),
  frame "Version history…" dialog (frame action "History" opens the panel on
  the frame), page actions `canvasVersions`/`restoreCanvasVersion`, editor
  page actions `revisions`/`restore`/`nameVersion`, ops
  `list_canvas_versions`/`restore_canvas_version`.
- Kept: MCP `list_motion_revisions`/`restore_motion_revision` and
  `feega motion revisions` (motion API, used by agents on one video), and the
  motion agent's own `list_/restore_revision` tools.
- Preview is a summary (nodes, connections; clips, seconds), not a rendered
  read-only canvas. Events are not yet restorable points.
- No migration.
