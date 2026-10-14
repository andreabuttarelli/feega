# Zoomed out, image and video nodes are drawn by the poster layer too

#597 took motion poster shells out of layout during a zoomed-out pan. Image and video nodes still
painted their own `<img>`/`<video>` in the DOM, so an image-heavy canvas kept the old cost
(harness, 500 image nodes: Chromium 4× pan 24 fps, WebKit pan p5 30).

`mediaPoster(type, url)` in `poster-lod.ts` is the one table of which node types get a poster and
from where: an image node from its 256 px tier (the existing `?size=256` transform, image tiers
untouched), a video node from a paused frame of its own file (seek to 0.1 s, draw, drop the
element). `Tile.poster` is now `{ url, source }`; the page builds it in `tilePoster`.

`oncePerUrl(load, limit)` loads each url once and caps concurrent decodes (8 images, 2 videos).
Without it 500 video nodes opened 500 `<video>` decoders at once and the tab crashed.

Harness: `CANVAS_PERF_MEDIA=image|video` (`-dom` suffix = old behaviour, no poster) in
`canvas-frame-budget.spec.ts`. Known gap: in WebKit a drag on a harness canvas of 200+ data-URL
`<video>` elements stalls (1–12 fps) with or without this change; drag is not gated.
