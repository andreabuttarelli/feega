# A URL import leaves the frame with a poster

A frame imported from a URL had no `posterAssetId` until a browser had built its vectors, drawn it
and uploaded a shot (`posterUploads`). A canvas of imported pages opened later showed white cards
until each source arrived and built, and every first open uploaded 36 posters, each one a write
(and in local mode a save of the whole `.feega`).

`readWith` in `import-url.ts` now asks the tab that just read the tree for `AppTab.poster`: one
puppeteer screenshot, WebP q80, clipped to the tree's width × height with `captureBeyondViewport`
and `clip.scale` so it comes out ~512 px wide. After the plan lands, the `keepPoster` port
(`canvas-import.ts`) saves it through `savePoster` at the frame's head version, so `posterFresh`
holds and the card shows it, and the client does not upload another. A shot or a save that fails is
swallowed: the import result is the same as before. linear.app: 512×3859 WebP, 93 KB.

Not done: scaling in the browser rather than at the screenshot (no `sharp` on this path), and
pages taller than WebP's 16383 px at that width (32:1) get no poster.
