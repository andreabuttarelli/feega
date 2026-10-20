# MCP: one `edit` tool and a `view` tool

An outside agent had to choose between `canvas_tool`, `motion_tool` and `motion_editor_op` (three
registries, three endpoints, 272 ops) and had no way to see the canvas except raw `query` rows.

- `POST /api/v1/edit` and the MCP tool `edit`: `{ op, target?, element?, input?, version?, project_id? }`.
  The op name decides the registry (canvas ops, frame tools, frame editor actions); `target` is the
  node or frame id, `element` an element inside that frame, and they fill the id fields of the op's
  input (`nodeId`, `frameId`, `elementId`, `clip_id`, `clip_ids`) when the caller did not.
- Name collisions: canvas wins, then frame tools, then editor actions; the loser is prefixed
  (`frame_list_templates`, `editor_list_fonts`, `editor_cancel_render`...). Computed in
  `edit-catalogue.ts`, tested to lose no op.
- `batch`: canvas and frame ops mixed, in order. Consecutive ops on one frame go through the existing
  frame batch: one revision, all or none. Across steps nothing is atomic: it stops at the first
  failure and answers `applied`, `failed`, and each step's result. A canvas op that answers 200 with
  an `error` body or an invalid/conflict outcome counts as a failure there (found live: a missing
  node did not stop the batch). No references between steps: create, then batch.
- `describe`: every op with family, access and one line; `{op}`, `{ops}` or `{schemas:true}` give
  strict JSON schemas, from whichever registry owns the op.
- `POST /api/v1/view` and the MCP tool `view` (a sibling, not an `edit` op: read-only, and
  `snapshot` answers image content): `canvas_summary`, `get`, `activity`, `snapshot`.
  `snapshot` reuses the frames renderer (`motionFrames`). Without local Chromium it forwards
  node, times and the caller's own bearer to the deployed app (`REMOTE_RENDER_URL`, default
  `https://oh.feega.app`, `off` disables; `frames-source.ts` picks local, remote or closed) and
  says `server_frames_unavailable` only when neither works. A whole canvas, a region or one element cannot be drawn alone and are refused with
  the reason. `activity` reads `canvas_events` and running runs; presence lives in the realtime channel,
  so it is reported as unavailable. Folds in `get_motion_summary` and `view_motion_frames`, kept.
- The three older tools stay as deprecated aliases. The route bodies moved to
  `server/edit/runners.ts` (a refactor commit, no behavior change) so one endpoint can call them.
- Verified live as the test account on localhost: create canvas and frame, add a shape, move it by
  frame+element id, free element, move_node, batch (success and failing midway), snapshot through
  the remote renderer (JPEG), delete. Not exercisable: presence (realtime only).
- The remote renderer reads the saved doc from the shared database, so an unsaved local doc is not
  drawn.
- Discarded: dispatching by calling the other route handlers in process (re-authenticates per op);
  folding the reads into `edit` (destructive hint on a read tool, no image result).
