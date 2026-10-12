# Masked layers no longer cut square at the frame edge

**Before.** A mask wrapper (`.km`) was `inset:0`, the frame box. Browsers evaluate a CSS
`mask:url(#svg)` only inside that border box (`mask-clip: no-clip` does not help in Chromium or
WebKit), so content past the frame — a 3D canvas at `left:1250px;width:1000px` — got a hard
straight edge, made diagonal by the layer rotation. Seen on embed fd37d96f (asteroid top right),
at every size and in every engine, so not an embed/fit issue.

**Now.** The wrapper spans the frame plus a 25% margin on each side, the content sits in an inner
`.kb` offset by the margin, and the SVG mask is shifted by the same amount. 25% matches the
effects filter overscan (`-25%/150%`).

**Discarded.** A wrapper as large as the old mask region (3× frame): WebKit then drops the whole
layer, because the `.ef` grain filter wrapping it grows past WebKit's filter size limit.

**Open.** On production, WebKit at DPR 2 already drops every grain-filtered asteroid (before this
change), for the same filter size limit.
