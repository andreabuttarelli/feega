# Conflict split view

`code-push/conflicts.ts`: `frameConflicts` lists files both the canvas edits and upstream changed (since `kept_sha ?? base_sha`), with base, canvas and GitHub contents. `frameResolve`:

- `keep_canvas` stores the upstream head as `kept_sha` on every link of the frame: status reads upstream from there, so the conflict clears and the frame shows `modified`; the canvas edits keep being computed on `base_sha`, and the next push writes the canvas file over the upstream change. Update clears `kept_sha`.
- `agent` answers `agent_unavailable` with a merge prompt (base/canvas/GitHub). Stub: no agent turn is started; the panel copies the prompt.
- Take GitHub is the existing Update (pull), not a new server path.

Deferred: property-level 3-way merge (decision 9), which should run before the split view and settle non-overlapping edits on its own.

Migration `20261117200000_frame_code_links_kept_sha.sql`, not applied in prod.
