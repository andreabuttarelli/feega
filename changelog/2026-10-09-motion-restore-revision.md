# Restore a motion revision

After the fd37d96f incident the agent told the user to Undo, which could not reach edits of a turn
still running. Nothing could put a saved revision back.

- `restoreRevision` (`server/motion/editor.ts`): reads version N, writes its doc as a NEW head
  (`Restored version N`). History is append-only; a restore is undone by restoring again or Undo.
- Motion agent: `list_revisions` (version, actor, summary, clip count) and `restore_revision`,
  via the `revisions` port wired in `turn.ts`. The prompt tells it to restore the last good
  version itself when it breaks the video, never to ask the user to undo.
- Editor: History button next to Undo/Redo → list → Restore (actions `revisions`, `restore`),
  off while the agent works; the restored head lands as one undo step (`adoptHead`).
- API `GET|POST /api/v1/motion/{id}/revisions`; CLI `feega motion revisions <id> [--restore N]`;
  MCP `list_motion_revisions`, `restore_motion_revision`. POST needs a write key.
- `listRevisions` reads the last 30 with their docs to count clips: an emptied version is visible
  in the list without opening it.
