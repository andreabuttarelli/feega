# SVG, multi-page PDF and single-element export

Follows the canvas export rows.

- Each frame is drawn in Chromium, seeked to its still, then frozen
  (canvases to images, scripts removed) and serialised as XHTML.
- SVG: the frozen page inside a foreignObject; text stays live text. It
  renders in browsers; tools that ignore foreignObject will not show it.
- PDF: one file per PDF row, a page per frame, each page at its own size
  (named @page), printed by Chromium so text stays text.
- Element: a target may name an element; raster rows crop the screenshot
  to its measured box, SVG and PDF set the viewBox to it.
- Free canvas elements now show Export too.

Found by the e2e: puppeteer's clip needs x/y, and measureClips run in
the page needs its kinds passed in.

Guard: tests/e2e/canvas-export.spec.ts (PDF page count, SVG text,
cropped PNG size).
