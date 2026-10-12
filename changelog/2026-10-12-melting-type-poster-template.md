# Melting type poster template

Black 3:4 editorial page on grey: index, two-line title, translated
subtitle, two body columns, footer, vertical credit. The top note, index
and title are drawn on a 2D canvas and melt per column into grainy
vertical drips, then reassemble; the loop ends crisp.

- Canvas 2D, not WebGL: per-column `drawImage` stretches are enough.
- Per-column noise is hashed (`meltColumns`), so drips cluster and are
  identical on every seek.
- The grain flows downward at a constant speed so the melted hold is
  never a frozen frame.
- No media: the template is text only, so no sample-table row.
