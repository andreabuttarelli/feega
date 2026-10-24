# Image tools: background removal and upscale

**Before:** the catalogue had image generators only. Video upscale existed; nothing took an
existing picture and returned a transformed one. Flora parity gap F1.

**Now:** two kie task models in `kie-catalogue.ts` (`kie/recraft/remove-background`, 1 credit;
`kie/topaz/image-upscale`, 10/20 credits for 2x/4x) with `requiresImage` and the `Image tools`
menu group, so they also show in the image node model picker. Credits come from the same
`PRICE_LINES` sum as every other kie row. Prices are kie's list as recalled, not re-read from
their price page: verify before turning on.

`startImageTool` (`server/canvas/image-tool.ts`) places a new image node right of the source,
wires source to it and runs `runGenNode` with an empty prompt. Entry points, one function:
selection toolbar buttons (`remove-background`, `upscale-image`, shown for one image with a
result) -> page action `imageTool` -> `startImageTool`; edit op `image_tool` (MCP/CLI) -> same.

**Decisions:** tool models are excluded from recommendations (`RECOMMENDATION_EXCLUSIONS`) so
"cheapest image model" never resolves to a background remover. `promptRequired` is false for
them like for the video upscaler. No new catalogue enum value: that would need a constraint
migration, and `menuGroup` already separates them in the picker. Tool pins refreshed on purpose
(`canvas_tool` description lists the new op).

**Not here yet:** layers split, inpaint, outpaint (next PRs of F1).
