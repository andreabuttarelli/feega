# gpu-full paints every text fill but tiled images

Diamond fills are four linear quadrants clipped to their quarter, as the page's four CSS layers.
Angular fills are 120 wedges, each a short linear gradient between its two edge colours.
Image fills become a picture matted by the glyphs (cover, contain, fill; tile stays named).
Blended fills are folded into one colour when every layer is solid (W3C blend formulas in
`blend-colour.ts`); a blended gradient stays named. Under text animators, text painted through
`background-clip: text` disappears in every unit the page isolates (transform or blur set, or
opacity below 1): Chrome skips descendants with their own stacking context. gpu-full now does the
same instead of naming the clip.

Parity (`kinds.ts more-fills`, `--ref=live`, 4 frames): mean SSIM 0.9970, worst 0.9968.

On the plan/geometry split: the new kinds live in `FillPlan` (`ClippedFill`); native text falls back to
outlines while gpu-core only knows solid, linear and radial plans. Isolated units get opacity 0 in
the plan looks, so both renderers skip them.
