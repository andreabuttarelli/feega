# Outline text draws the same letters the canvas draws

Outline text (`Command.TextToPath`, ⇧⌘O, MCP `text_to_path`) changed the font and the letter
layout. It had its own pipeline: an opentype.js font fetched from the Fontsource CDN (not the
file the canvas loads, upright only), per-character advances with no shaping, its own wrapping
(`measureText`), its own baseline and leading, and coordinates rounded to 1/1000 of the box. The
renderer shapes with the gpu-text faces (`loadFonts` → `faceBook`), lays out with `planOf` +
`layOut`, and places lines with its own leading, fit and vertical align. Same text, two layouts:
12–140% pixel difference with the same font file.

Now `textToPath` runs the renderer's pipeline: the clip's props from `prepare(...)`, `planOf`,
then `outlinesOf` (new, in `gpu-full/text/painter.ts`), which walks the same laid lines through
the helpers `inksOf` uses (`lineAt`, `drawnOf`, `gapOf`, extracted in a separate commit). Each
glyph's `face.outline` commands become path curves in the clip box, with skew for synthetic
italic; underline, strike and paragraph rules become polygons. `outlineTexts` takes a
`LetteringLoader` (`letteringOf(tokens, assets)`), wired in the canvas (`GpuFlow`), the frame
inspector and both server tool paths with the brand tokens and asset URLs.

`text-outline-pixels.test.ts` rasterises text and its outline (sans, Google sans and serif,
variable weight, kerning/ligatures, synthetic italic, fitted title, tracked kicker, justified
mono) and asserts under 2% ink difference; what remains is the renderer's own curve flattening.

Decisions: `MAX_PATH` goes 20 000 → 200 000 characters, since real glyph curves at 0.05 px
precision did not fit a sentence. `align` is no longer copied (text `justify` is not a shape
align). Per-run colours/gradients and text animators are not carried: one shape, one fill.
`fonts/outliner.ts` and its opentype.js loader are deleted.
