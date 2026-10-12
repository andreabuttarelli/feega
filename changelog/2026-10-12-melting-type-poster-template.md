# Melting type poster template

Dark 3:4 editorial page on grey: masthead and credit, three-line title with
a large number, lede, footer note, three body columns. Every inked pixel of
the page is a sand grain: the page crumbles top to bottom, grains fall straight
down under gravity and leave the page, then rise straight back into type with an expo in-out; the loop ends crisp.

- Canvas 2D, not WebGL: one `putImageData` per frame over ~10^5 grains is
  cheap on CPU, deterministic, and needs no GPU context in the renderer.
- Grains come from the rendered text's alpha, so the page at rest is the
  text itself, with no swap between DOM text and particles.
- Release order is a hashed noisy front. A grain keeps its column: no wind,
  no heap. An earlier draft piled a toppled heap with wind drift; dropped on
  feedback (oblique fall, sand accumulating at the bottom).
- First draft melted only the top lines into drips with copy close to the
  reference; replaced on feedback with full sand and original copy/layout.
- No media: the template is text only, so no sample-table row.
