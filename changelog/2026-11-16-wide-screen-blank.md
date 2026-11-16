# Wide screens no longer blank the canvas on pan or zoom

Two bugs chained together:
1. The desktop direct path held a scene across frames, but the layer caches could unregister
   images that scene still drew. WebGPU then panicked ("invalid empty image").
2. The core reattached on WebGL. On a wide window at DPR 2 the surface (4316 px) is past
   WebGL's 4096 limit, so every frame failed, and the loss path reattached forever on the last
   backend.

Fixes:
- Images a held scene still draws are pinned against cache eviction.
- `fitResolution` (`src/lib/canvas/gpu/surface-fit.ts`) lowers the surface resolution so the
  surface plus overscan stays within 4096 on every backend.
- `afterLoss` gives up to the fallback after repeated losses on the last backend, instead of
  looping.
