# Seedance 2.5 on Higgsfield, every API mode

Five catalogue entries in `higgsfield-catalogue.ts`, one per endpoint, as Kling
and Hailuo already are ("· from image"): from text, from image, from
references, edit video, extend video. Schemas from
`docs.higgsfield.ai/docs/models/seedance-2-5/*.md`.

- Sizes: 480p/720p/1080p everywhere; 6 aspect ratios on text and references
  (image and edit follow the input's framing). Durations 4–30 s offered as
  4 5 6 8 10 12 15 20 25 30: one `/estimate` per duration × resolution, and 27
  integer steps would be 81 calls per model at each sync. Edit sends no
  duration (the API derives it from the source) and is priced per resolution.
- Inputs: image-to-video requires an image (`end_image_url` from the last-frame
  port). References take ≤30 images, ≤10 videos, ≤10 audios. Edit and extend
  require a source video (`requiresVideo`, refused before spending): the first
  wired video is `video_url`, the rest go to `video_urls` (≤9, the source
  counts toward 10).
- Port capacities live in `TASK_VIDEO_REFS` (`video-models.ts`), read by both
  the canvas (`graph.ts`) and the server (`upstream-inputs.ts`).
- Chat agent: `list_models` reads the same catalogue, so the five modes come
  with their inputs, resolutions and durations; `run_node` runs them.
- Not exposed: `generate_audio` (default true), `bitrate_mode`, `output_format`.
  Booleans reach the wire as strings today.
- Open: the edit price comes from `/estimate` on a placeholder source; how
  Higgsfield prices a real source of a different length must be checked once
  the keys are in Vercel.
