# Nine more still posters, every part fully editable

## Why

Nine more references (19–27), same `poster-kit.ts` pattern as batches 2–4. This round also
answers a request from whoever builds the canvas's part→fields mapping: selecting a data-part on
one of these posters must show text, colour and position controls for that exact part, not a
handful of shared `ink`/`accent` fields covering the whole poster. Naming is now
`<part>`, `<part>Color`, `<part>Font`, `<part>Size`, `<part>Weight`, `<part>X`, `<part>Y` per
part, so a mapping can be derived from the prop names instead of hand-written per template.

## What

- `builtin:poster-haze-grid` (ref 19): a blue-black gradient with a haze low-left, a stacked
  word-pair title on a fine grid, numbered superscripts after each word (`row side number`
  lines), a note and a paragraph lower right. Own: `issue` corner line, `marker` circle,
  `caption` vertical edge.
- `builtin:poster-flow-quote` (ref 20): black background, a quote split across white pill
  labels (SVG `rx = height/2`, never CSS `border-radius`, so the shared shape test still holds),
  connected by square-jointed or circular-jointed straight lines — the reference's rounded
  branching connectors, approximated within the house rule (circle or sharp rectangle, nothing
  between). Own: `marker` accent circle, `index` small pill.
- `builtin:poster-stacked-plus` (ref 21): heavy lowercase words stacked, each with a paraphrased
  note line, a yellow plus (two rects, not a glyph), a blue quarter circle (SVG arc path) and an
  orange rectangle. Own: `marker`, `index`, `caption`.
- `builtin:poster-barcode-table` (ref 22): a white table grid, a generated barcode column (bar
  count and the CJS/English bilingual pair replaced by a primary/secondary title pair, one serif
  one sans — an own-design difference, this kit has no CJK coverage), event rows, partner marks,
  an accent number cell. Own: `counter`, `index`.
- `builtin:poster-pixel-caps` (ref 23): warm off-white, a 3-line heavy caps title over a
  generated scatter of small pixels, two black blocks, two photo slots, two justified columns.
  Own: `blockNumber`, `blockLabel` — literally the "own mark" vocabulary the shared test already
  expects.
- `builtin:poster-month-grid` (ref 24): a label on a yellow highlight, huge thin month words
  layered under a grid of yellow event cards (`cardsPos` + `cards`, same two-list pattern as
  curated-board's slots/captions). Own: `marker`, `index`.
- `builtin:poster-rotated-cards` (ref 25): a big serif title over slightly rotated colour cards,
  each with a lighter left edge, a hashtag chip and a name, a year tag and a wordmark. Own:
  `marker`, `index`.
- `builtin:poster-brick-caps` (ref 26): a generated brick/line texture, stacked black-bar caps
  lines, four info corners (`TL/TR/BL/BR | text`). Own: `marker`, `index`.
- `builtin:poster-dark-tags` (ref 27): dark grey, a huge light-grey multi-line title, small
  coloured name tags scattered over it, a framed `marker`, an `index` line.

All nine ship with placeholder copy only — no names, venues, dates or quotes from the references;
two defects from this round went into `posters.test.ts`'s `REFERENCE_WORDS` guard failing first:
`cal poly studio`/`merrill elam` (ref 24's real architects), `studio berlin` (a real city), and
`Idea Factory` (ref 22's real venue) all had to be rewritten.

## Per-part fields, and the structural wall

`PropSpec` is flat key/value — string, number, color, font — never an array of objects. A
repeated part (`rows`, `pills`, `tags`, `cards`) can't carry a `<part>X`/`<part>Y` pair per item,
so its position stays embedded in the line itself (`text | x | y | w`, the existing convention),
and the part gets one shared `<part>Color` for the whole list. A genuinely singular part (a
title, a marker, a caption) gets the full set. `poster-part-fields.test.ts` encodes this split
per poster (`full` vs `colorOnly` vs `shape`) so the convention doesn't quietly rot into
exceptions nobody wrote down.

The other wall: `customTemplateDoc` refuses more than 40 props. A first pass gave every part
Color + Font + Size + Weight + X + Y and blew straight through it (`haze-grid-poster: at most 40
props`). The fix wasn't more generosity — it's one shared `font` field per poster (title keeps
its own `titleFont`/`rowsFont` where the reference actually mixes two typefaces, e.g.
barcode-table's serif secondary line), and `Weight` only on the one hero part per poster. Every
part still gets its own text, colour and X/Y — that's the line the new test holds.

## Bugs paid for before they shipped

- **`linesOf` splits on `\n`, and a `word|note|side` row's note can't contain one.**
  `stacked-plus`'s first draft embedded a second line inside the note field
  (`'slow|say less..,\nask more..,|R'`); `linesOf(p.rows)` split on that inner `\n` too, turning
  one row into two malformed ones — the second missing its word, rendered at the full title font
  size. Signal: a fragment of a note appearing as a huge headline on its own line. Fix: no `\n`
  inside a single row's fields, ever — multi-line notes wrap naturally instead.
- **CSS Grid side-swapping for L/R notes looked worse than no layout**: the word jumped to the
  opposite margin per row, breaking the stacked-left rhythm every one of these references relies
  on. Replaced with: word always flush left, note always a smaller block immediately before or
  after it — still reads as "annotated word", never off-axis.
- `white-space: pre` on a body paragraph with no explicit `\n` doesn't wrap — it just overflows
  past its own `width`. `pre-line` wraps long lines and still respects explicit breaks; every
  multi-purpose text block in this batch uses it now.
- A caps bar whose text is longer than the canvas (`LIVE SETS, OPEN FLOOR` at a fixed 9%) needs
  the same shrink-to-fit pass `curated-board`/`wide-filmstrip` already use — added to
  `brick-caps`'s `.bc-bar`s.

## Rendering

`scripts/component-previews.ts` (dev server + Playwright's `chrome-headless-shell`, documented
in `changelog/2026-10-12-component-library.md`) made the 480px library previews. Full-resolution
PNGs (1080×1350, 9:16, A poster, 1×/2×) came from a throwaway script using the same
`chromiumFrames`/`composeHtml` pair `still-export.ts` uses in production, deleted after the
renders — nothing permanent added to `scripts/`.

## Discarded

- A `9999px` CSS border-radius for flow-quote's pills — the shared shape test allows only
  `radius: 50%` literally; drew the pill as an SVG `rect rx="height/2"` instead, same pattern
  curated-board already uses for its tag pills.
- Per-item `<part>X`/`<part>Y` for list parts — the schema has no array-of-object prop type;
  documented as a real gap, not quietly worked around.
- Literal CJK text for barcode-table's bilingual title — this kit has no CJK font coverage
  guarantee; used a primary/secondary (sans/serif) title pair instead, which carries the same
  "two scripts, two voices" idea without assuming a font that may not render.
