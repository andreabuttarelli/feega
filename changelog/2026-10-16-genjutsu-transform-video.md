# Transform video: Genjutsu motion transfer, object swap, restyle

Higgsfield's video-to-video models, from
`docs.higgsfield.ai/docs/models/genjutsu/*.md`, in the Generate video node.

- "Transform video" is a group of the model menu (`ModelChoice.menuGroup`,
  from `wire_spec.menuGroup`), not a separate node: the node already has the
  ports, the run path and the history, and a toggle would duplicate the model
  menu.
- Inputs: a source video on the videos port (any video node, or a social feed's
  `out:videos`): `video_url`, required (`requiresVideo`, refused before
  spending). Images on the images port: `image_urls`, 1–8 required for motion
  transfer and object swap, 0–5 for restyle. Capacities in `TASK_VIDEO_REFS`.
- Source length 4–30 s: the provider trims longer clips to their first 30 s
  and refuses shorter ones; no duration is known here before submit, so no
  local check.
- Restyle presets: `GET /models/higgsfield/genjutsu/restyle/v1.0/presets` at
  sync, stored as `param_schema.preset_id` enum with `labels` (names), shown by
  the node toolbar as "Style" (`optionLabels`). No presets readable → restyle
  is left out of the catalogue. A run without a style is refused
  (`requiredParams`).
- Pricing: Genjutsu bills per source second ($0.318 / $0.681 / $1.632 per s at
  480p / 720p / 1080p), so no catalogue line can be right. `quotedAtSubmit`
  models call `POST /estimate/<path>` with the real body just before submit
  (`TaskProvider.quote`), refuse when no quote comes back, and store it in
  `node_runs.params.quotedUsd`; `finishTaskJob` bills that. Seedance 2.5 video
  edit moves to the same path (it also bills the source length): this closes
  the open point of the Seedance PR.
- Chat agent: `list_models` now returns `group` and `params` (names, values,
  labels), so the agent finds Transform video and the restyle presets and
  passes `params.preset_id` to `run_node`.
