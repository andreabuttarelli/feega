# Local projects keep their canvas in a `.feega/` folder

ADR 0041. Local mode (`FEEGA_LOCAL_FILE`, desktop *Open Project Folder…*) accepts a directory: the
canvas lives in `<dir>/.feega/` as one sorted-key JSON file per node, connection and media row, so
git diffs and merges per node instead of on one zip.

- `packages/canvas-folder`: format (`toFiles`/`fromFiles`), `mergeFolders` (3-way per node and per
  `data` field, losing side kept as a conflict record), `relationOf`, `resolveConflict`. No app
  imports.
- `feega-folder.ts`: a `Persistence` next to the file one in `feega-store.ts`. Base in
  `.feega/.base/`, Feega's state kept aside in `.feega/.ours/` when the folder changed on disk while
  open (never overwritten). On open: same / ahead / behind apply, diverged merges.
- Assets: `.feega/assets/<sha256>.<ext>`, deduped by hash; remote URLs are downloaded at open and
  at each save, failures listed.
- A folder whose `.feega` is the old single file is migrated; the file is kept as `legacy.feega`.
- UI: `FolderSyncNotice.svelte` polls `/local/folder`; Keep theirs reloads the canvas.

Not done: live accept without reopen; the web snapshot writer (Composio/GitHub); Save As for a
folder.
