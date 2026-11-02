# Motion text: no more missing-glyph boxes past Latin

`fontLoader` (`gpu-full/text/load.ts`) asked the fallback fonts only for code points from U+2000,
and the fallback chain (`SYMBOL_FALLBACKS`, `gpu-full/text/fonts.ts`) was Noto Sans Symbols 2 and
Noto Sans Math. Greek, Cyrillic and anything else a family lacks below U+2000 had no fallback, and
box-drawing / misc-technical glyphs (`╭ ⎿`) were in neither font: tofu in Fragment Mono, and `⎿`
even in JetBrains Mono.

The hypothesis that Google CSS served only the `latin` subset was wrong: the per-subset
`unicode-range` faces already load (JetBrains Mono box-drawing resolved before the fix).

Fix: fallbacks are asked for every code point from U+0250, narrowed with `text=`, and the chain is
Noto Sans, Noto Sans Mono, Noto Sans Symbols 2, Noto Sans Math, Noto Sans Symbols.

Not changed: the HTML render (`composeHtml`, Chromium) still relies on system fonts for glyphs
the family lacks.
