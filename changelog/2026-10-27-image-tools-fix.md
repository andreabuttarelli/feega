# Image tools: inverted mask, uploaded photos, upscale

A real-generation eval (`~/feega-videos-tmp/image-eval/REPORT.md`) found three defects.

**Mask polarity.** `maskPng` painted the area to change white. `kie/ideogram/v3-edit` repaints
BLACK and keeps white, so inpaint kept the painted area and regenerated the rest, and reframe
left flat grey bars. The convention now sits in one table, `MASK_PAINT` in `src/lib/image-tools.ts`,
keyed by model; a model with the other convention is one row. `maskPng` takes the paint as an
argument and both callers read it from the table.

**Reframe.** With the mask fixed the model still returned the grey padding. Padding is now the
picture's own edge colours, blurred (`PADDING_BLUR`), and `REFRAME_PROMPT` asks for new content
instead of "extend naturally". Tried and discarded: mirrored padding (an upside-down face above
the head), and unblurred edge padding (vertical streaks).

**Uploaded photos.** Upload nodes carry `data.assetId` and no `refId`. `sourceAssetIdOf`
(`src/lib/canvas/image-source.ts`) resolves either, and is used by the server check
(`image-tool.ts`, `video-reframe.ts`), the upstream wiring (`upstream.ts`), the UI predicate
(`selection-actions.ts`) and the inpaint dialog source. Dropped, feed, product and Figma images
already land with one of the two ids.

**Upscale.** The kie request body matched kie's docs exactly (`input.image_url`,
`input.upscale_factor` as a string) and `kie/topaz/image-upscale` still answered
`kie_task_failed: internal error` on 2x, with a JPEG and a PNG, so Topaz on kie is down for us.
Upscale now runs `kie/recraft/crisp-upscale` (one row in `IMAGE_TOOL_MODEL` and
`KIE_TOOL_MODELS`; field `image`, flat $0.0025). It has no factor and doubles the size (1024 to
2048 measured), so `factor` is accepted but ignored and the node is named `Upscale 2×`.
The `ai_models` row appears with the next catalogue sync after deploy; until then upscale is
refused as `unknown_model`, as it was failing before.
