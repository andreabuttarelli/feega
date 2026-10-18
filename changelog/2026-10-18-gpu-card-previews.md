# GPU canvas: card previews kept on the server, canvas shown once they are in

Rasterised cards lived only in the browser's Cache Storage, so a new
browser, a cleared cache or another device opened a canvas of blank
cards that filled in one by one.

- Each card preview is uploaded to `canvas-assets` at
  `<org>/<project>/card-previews/<nodeId>.<sha256(key)>.webp` after it is
  first rasterised; older previews of the node are removed. No DB row:
  writing to `nodes` would change the very key the preview is named
  after.
- The canvas load returns the newest preview per node (one storage list,
  one batch signing). The client shows the local cached preview, else
  the server one, and re-rasterises only when the key differs.
- The canvas stays hidden (background only) until every node in view
  has its preview, or for at most 1.5 s, measured from the first laid-out,
  fitted frame. 600 ms left 13–39 nodes unpainted on a cold Chrome open
  and ~50 in WebKit; all painted took 0.9–3.6 s cold in Chrome and ~1.3 s
  in WebKit.
- Card capture (html-to-image) waits for 400 ms without pointer, wheel
  or key input and an idle slice with 12 ms left, so it no longer runs
  under a drag or while typing.
- Nodes without any preview draw their data-driven card (title, kind
  icon, media) as before.
