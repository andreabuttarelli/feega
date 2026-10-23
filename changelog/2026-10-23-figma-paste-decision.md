# Figma paste: why it stays on "Copy as SVG"

Parity roadmap, Figma paste row. No code change; the existing path stays.

Research (third-party reverse engineering, nothing official):
- Figma's clipboard `text/html` carries `<!--(figmeta)...-->` and `<!--(figma)...-->`
  comments holding base64 of a `fig-kiwi` archive: a header, a Kiwi schema chunk and
  a Kiwi data chunk (`nodeChanges`: frames, rectangles, text, vectors with
  `fillPaints`, transforms, `commandsBlob` geometry). Decoding is possible in
  principle with `kiwi-schema` plus deflate/zstd.
- Against it: the format is undocumented and the schema changes with Figma
  releases (Grida notes clipboard breaks follow schema changes); recent payloads may
  have no visible HTML at all; the data chunk compression has changed over time.
- No real Figma payload was available in this environment (no Figma access), so a
  decoder could only be tested against fixtures built from our own assumptions. A
  decoder nobody can prove against the real thing is the "green suite, nothing works"
  failure CLAUDE.md warns about.

Decision: keep the fallback already shipped. A Figma paste is detected by its markers
and shows "Use Copy as, Copy as SVG, then paste here"; "Copy as SVG" lands in
`text/plain` as markup and imports as layers (gradients, rounded rects, clip bounds,
text) through the SVG path. Revisit with a real captured payload as a fixture.

Sources: grida.co/docs/wg/feat-fig, tessl.io registry grida io-figma, openfig-core.
