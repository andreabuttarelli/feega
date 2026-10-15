# Fix the dropped font on batches 2–5 posters

## Why

`fontOf` (`poster-kit.ts`) quotes a single font name with `"`: `'"' + f + '", system-ui, ...'`.
Three batch 2–5 posters build their `style="..."` attribute by concatenating that string
straight into HTML (`dark-tags-poster`, `brick-caps-poster`, `flow-quote-poster`): the `"` in
the font name closes the attribute early, and every browser parses the rest
(`system-ui, sans-serif"`) as stray bare attributes on the element. The chosen font never
applies; the element falls back to the page default.

Batch 6 (`9e7c7244c`, PR #605) hit the same bug and fixed it locally with a `cssFont` helper
that swaps the quotes to `'`, used only by `POSTER_TEXT`'s `textPart`. Its own changelog entry
flagged the rest: "Batches 2–5 still inline `fontOf` that way (e.g. `dark-tags`); not touched
here."

## What

- `fontOf` itself now quotes with `'`. It is prepended to every poster's JS via
  `POSTER_HELPERS` in `posterComponent()`, so the fix is one line and reaches every poster that
  calls `fontOf` directly inside a `style="..."` string, not only the three now-regressed ones:
  future posters inherit the correct quoting by construction.
- `cssFont` becomes `fontOf` under another name (its `.replace(/"/g, "'")` is now a no-op on an
  already single-quoted string); left in place because five batch-6 posters call it by name.

## Decisions

- Fixed in the one shared helper, not per poster. The three broken posters needed no edit.
- Considered wrapping every `fontOf(...)` call site in `escaped(...)` instead (HTML-entity the
  quotes). Rejected: it still leaves double quotes as the on-disk convention, so the next poster
  copy-pasting `fontOf(p.font)` into a `style="..."` string reintroduces the same bug. Fixing the
  quote character at the source removes the footgun instead of papering over each use.

## Tests

`posters.test.ts`'s `describe.each([...POSTERS, ...PART_TAGGED])` (now every poster-kit poster,
batches 2–6, run under `@vitest-environment jsdom`) gained `keeps each font inside its style
attribute`: draws the component for real and asserts `innerHTML` doesn't contain
`system-ui,=""`, the signature of a font dropped mid-attribute. Red on `dark-tags`, `brick-caps`,
`flow-quote` before the fix; green after. `poster-batch-6.test.ts`'s own copy of this check
still passes (now redundant with the general one, left as-is).

Before/after renders of the three affected posters:
`~/Documents/feega-videos/screens/poster-fonts/{dark-tags,brick-caps,flow-quote}-{before,after}.png`.
