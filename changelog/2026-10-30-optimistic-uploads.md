# Uploads show the local file at once; runner ops survive a reload

**Uploads.** A file dropped on the canvas waited for the storage upload and the `upload` action
(681 ms for a small PNG on the test account, seconds for a video) before any tile appeared. Now
the `Upload` registry row shows a pending tile under the final node id, drawing the local blob
(`URL.createObjectURL`) for pictures, with a progress bar fed by the signed upload
(`storeFile`, the progress uploader of the frame library, now named). The upload starts on the
gesture; the op sends `upload` with `node_id` once it is stored, and the pending tile becomes the
stored node. Uploads run on their own runner (same port), so a long video does not hold up the
other canvas writes. Uploads into a frame are unchanged (already shown by the frame editor when
inserted from the add bar; a paste over a frame still waits).

**Reload mid-save.** Lines, moves and node data already lived in the IndexedDB outbox; runner ops
did not. `optimistic()` now keeps each op's request (`requestOf`) in the outbox `sent` list from
the gesture until the answer (`src/lib/canvas/sent-ops.ts`). On reopen the left-over requests
are sent again in order, then the canvas refreshes. Every runner action is safe to send twice:
client-chosen ids make a second create a conflict, deletes and renames are idempotent. Uploads
are not kept (the file is gone after a reload); comments and pages runners are not kept.

| Action | Before | After (server delayed 2 s) |
|---|---|---|
| Upload a picture on the canvas | 681 ms | 41–45 ms (local picture + progress) |
| Delete, then reload before the answer | lost | sent again after the reload |
