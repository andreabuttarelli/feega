# 3D node: model picker, text input, moderation exception

**Why.** The `model3d` node had no model dropdown (image/video had one in the selection toolbar)
and accepted images only. Image-only 3D runs in standard projects were also refused by moderation:
empty prompt + a reference the text judge cannot see → the judge refuses "when in doubt".

**What changed.**
- Picker: `model3d` joins `GEN_TYPES` in `common-properties.ts`, so `SelectionToolbar` shows the
  same `ModelMenu` + `NodeSettings` as image/video, fed by `canvasModelCatalogue().model3d`.
  Settings are curated in `MODEL3D_SETTINGS` (`model3d-models.ts`): Trellis/Pixal3D `pipeline_type`
  shown as Resolution 512/1024/1536, Hunyuan3D `generate_texture` as Textured on/off. Other Wiro
  params (`texture_size`, steps…) are not offered. `ModelParam` enum gained `optionLabels`.
- Validation: `model3dParamsOf` fills missing settings with the first (cheapest) value — Trellis
  512 — drops unknown keys, refuses unoffered values before any spend. The quote uses the same
  defaults.
- Text: `NODE_PORTS.model3d.inputs = ['images', 'text']`, graph `requiresOneOf: image|text`,
  `upstream.ts` adds `text` to the model's modalities for this node (`NODE_ADDED_MODALITIES`).
  Run rules in `MODEL3D_RUN_RULES` (`model3d-run.ts`): image → direct; text only → product shot on
  `cheapestImageChoice` (non-uncensored, reads text, priced) with `productShotPrompt`, deposited as
  an image asset and shown as `posterRefId`, then the 3D job; neither → refused. The text is
  screened (`screenModelInput`, standard) before the image step. Both steps write `ai_calls`.
  The quote adds the image step's credits when no image is connected.
- Moderation: `STAGE_RULES` in `screen.ts` — `operation: 'model3d'` with empty text runs no stage
  and records `skipped: no text (model3d)`. Text is still screened; the uncensored likeness guard
  in `wiro-run.ts` runs before screening and is unchanged.
- Template `text-3d` (doc → model3d on `text`).

**Discarded.** A generic "default = first enum value" for every model's params: for other Wiro
models an unsent param means the provider default, which may differ.

**Known.** When Wiro returns its own preview render, it replaces the intermediate product shot as
poster on landing.
