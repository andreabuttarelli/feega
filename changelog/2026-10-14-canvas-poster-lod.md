# Zoomed-out canvas draws posters on one canvas

Below zoom 0.3 (`LOD_ZOOM`), nodes with a poster (motion frames, via `frameLook`) are drawn by
`CanvasPosterLayer` as 160 px thumbnails on a single `<canvas>`; their DOM content gets
`visibility: hidden` (selected nodes stay DOM). Node wrappers stay, so hit testing, selection and
drag are unchanged. The switch waits 150 ms after the zoom settles (`LOD_SETTLE_MS`): flipping
mid-gesture cost WebKit 500-node zoom 40 -> 21 fps p5.

Measured on the motion harness, 1440x900 (fps avg / worst 5%):

| case | before | after |
|---|---|---|
| Chromium 4x CPU, 500 zoom | 11 / 3 | 60 / 60 |
| Chromium, 500 zoom | 47 / 20 | 60 / 60 |
| WebKit, 500 zoom | 60 / 40 | 60 / 53 |
| WebKit, 500 overview pan | 53 / 29 | 58 / 36 |
| WebKit, 500 drag | 54 / 36 | 60 / 43 |

Discarded: hiding per-node with a generated 500-selector stylesheet (style recalc on every
crossing), and `onlyRenderVisibleElements` (mount churn on zoom-out in WebKit).
Open: WebKit 500 overview pan worst 5% stays under 45 fps.
