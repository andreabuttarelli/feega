# GPU canvas: memory budget on phones

The heavy canvas (64 nodes, 41 motion frames) reloaded in a loop on iPhone Safari after the
WebGPU canvas became the default. Measured in Playwright WebKit with the iPhone 15 Pro
descriptor (DPR 3, service workers blocked) and an in-app counter of GPU texture bytes
(`window.__gpuCanvas.textures()`): 378 MB of textures, three of them 3574×3574 with mipmaps
(68 MB each). Images outside the `canvas-assets` path are not resized by the server, and the
texture cache decoded them full size.

Now, one table per device in `memory-budget.ts`. On a touch device:

- images and card snapshots are decoded to 512 px on the long edge (desktop 2048);
- renderer resolution ≤ 2, no MSAA;
- texture LRU budget 128 MB (desktop 256), and a texture is pinned only while a card that
  uses it is in view (`texture-pins.ts`); off-screen cards load nothing until they scroll in,
  and an evicted card reloads when it comes back;
- the ImageBitmap behind a texture is closed once uploaded (Pixi's texture GC is off, so
  nothing re-reads it; a lost device builds a new scene anyway);
- no off-screen DOM tile is mounted to shoot posters or snapshots: the phone shows the
  server-stored previews, desktops keep producing them.

Production build, same profile:

| | before | after | DOM renderer |
|---|---|---|---|
| textures | 378 MB | 80 MB | — |
| WebKit GPU process | 1102 MB | 272 MB | 543 MB |
| WebKit WebContent | 935 MB | 647 MB | 925 MB |

WebContent on a static page (`/changelog`) is ~290 MB in this WebKit build; the remaining
~350 MB is the canvas route's JS and data, not images (blocking every image leaves it at 640).
