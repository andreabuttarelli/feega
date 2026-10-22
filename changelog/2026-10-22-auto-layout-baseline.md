# Auto layout: baseline alignment

Parity roadmap P3. `Align.Baseline` lines up the first baselines of a
horizontal row (each wrapped line on its own). A text's baseline is estimated
like its extent (`textBaseline` in `text-extent.ts`: inset, half the extra
leading, 0.8 em ascent); a clip without text sits on its bottom edge, as in
CSS. A hugging row grows to hold what hangs below the baseline. Vertical flows
and grid cells treat baseline as start (Figma offers it only on horizontal).

Properties: a baseline toggle next to the alignment grid on horizontal rows.
`set_auto_layout` takes `align: baseline`. Export and the GPU canvas draw the
computed boxes (compose test, `canvas-auto-layout-baseline.spec.ts`).

Known gap: the ascent is a constant, not read from the font.
