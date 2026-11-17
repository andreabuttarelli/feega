# Code export keeps paint, fonts and shadows

Exported code lost several things the canvas draws: uploaded fonts (only Google
`<link>` tags were written), blend modes, angular and diamond gradients, the
centre and size of radial gradients, stroke alignment, text shadows and masks.

Each now has one table next to the model it governs in `codegen/paint.ts`:
- fills become stacked background layers, each with its own blend;
- strokes pick `border`, `box-shadow` rings or `outline` by alignment and dash;
- effects have a box table and a text table (`text-shadow`);
- masks: a plain rect or ellipse becomes `clip-path`, the rest is noted.

Fonts: `codegen/fonts.ts` reads `doc.fonts`, ships every variant of an uploaded
family used by the page as `@font-face` + file in `assets`, and asks Google for
the real axes. `codeAssetIds` returns the font asset ids so the API signs them;
the zip, the CLI and `export_code` already download every entry of `assets`.

Rejected: `border-image` for gradient strokes (drops the radius), an SVG data
URI for masks (not responsive). Both are listed under Not exported.

Test: `paint.test.ts`, `fonts.test.ts`, `export.test.ts`, and the pixel gate
`export-pixels.browser.test.ts` (needs `CHROMIUM_PATH`).
