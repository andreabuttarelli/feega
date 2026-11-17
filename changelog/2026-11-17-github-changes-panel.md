# GitHub sync: status popover and Changes panel

**Before.** The header showed the GitHub state; clicking it only selected the frame.

**Now.**
- `SourceSyncPanel.svelte` (in `GpuFlow`): the popover anchors under the header icon; actions
  come from `ACTION_RULES` in `source-changes.ts` (Update / View PR / Detach). Update calls the
  existing `code-import/[nodeId]/pull`.
- Changes panel: `changedRows` (modified, conflict), checkboxes, `pushAskOf` reuses the open
  `feega/<name>` branch so "Update PR" lands on the same PR. `needs_confirm` asks and retries with
  `confirmSensitive`; `read_only` downloads the edited files. Undo calls `push/undo`.
- Detach: `LinkStore.remove`, `frameDetach`, `DELETE github/push`, CLI `github detach`, MCP
  `github_detach`.
- The poller keeps the whole status answer (link, PR, checks), not only the state.

**Deferred.** Before thumbnail (only the current poster exists; no capture of the imported
state is kept), variant choices (variants arrive with "Make variant of"), the split view for
Update conflicts, and moving `baseSha` forward after Update.
Screenshots were taken on a temporary component harness, not the logged-in app: no test-account
password was available locally.
