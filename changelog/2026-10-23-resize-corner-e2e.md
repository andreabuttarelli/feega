# Corner resize: per-frame e2e

User reported a filled box staying put during a corner drag while the
selection scaled around its centre. Headed Chrome + WebGPU, DPR 2, on a
fresh dev server and on the local :5173: fresh box, all four corners,
reloaded, double-clicked, zoomed in/out, seeded and drawn in a frame —
every mid-drag frame keeps the opposite corner within 2px and the fill
follows the pointer. Not reproduced, so no fix.

`tests/e2e/canvas-resize-corner.spec.ts` guards it frame by frame (fill
edges from pixels, selection from the DOM). Dev pushes are skipped by
Vercel's Ignored Build Step and main predates #1152/#1189/#1186, so
feega.app still has the old behaviour.
