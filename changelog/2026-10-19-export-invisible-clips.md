# Export skips nodes at opacity 0

**Symptom.** The trailer (music on a `Video` clip at `opacity: 0`) failed in-app export, HTML
path and `?engine=gpu-core` alike: "the frame at ~37 s / ~55 s did not draw within 60s".

**Cause.** The capture rasterises the music layer every frame. html-to-image cloned its
`<video>` (the mp3 carries cover art, so `videoWidth > 0`) into a nested `data:image`, inside
a box at `opacity: 0`. `paintSvg` waits up to 120 animation frames for a nested picture to
appear in a blank layer; this layer is blank forever, so every frame paid the full wait
(~2–3 s locally). Under four lanes rAF slows to ~350 ms, the wait reaches 40 s, and a lane
overruns the 60 s shared deadline.

**Fix.** `unseen` (was `offStageClip`) also drops any element whose computed opacity is `'0'`
from the html-to-image filter: it paints nothing, so the output is identical and the layer
carries no nested picture to wait for. Frame at 55.2 s: 3.2 s → 30 ms.

**Discarded.** A wall-clock cap on the blank wait: every frame would still burn the cap, and
the 120-tick wait exists for WebKit's late nested pictures.
