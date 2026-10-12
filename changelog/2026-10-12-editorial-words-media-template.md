# Editorial words and media template

New built-in `builtin:editorial-words-media`, built from a reference: very large lowercase
words on a three-row loose grid, alternating sides, with pictures/clips in the empty cells and
a closing quote mark. Phrases (one per line, `/` splits grid lines) play one at a time; reveal
order is word, picture, word, picture, word, quote, one `beat` apart.

- Words use the shared `wordIn` (move while fading); pictures open from their centre with an
  in-out expo clip, then drift slowly so holds are never frozen frames.
- Landscape/square: words and pictures side by side. Portrait: rows stack, pictures between.
- Font size is capped by an estimated line width so the longest line always fits.
- Loop: frame 0 and the last frame are both the empty page.
