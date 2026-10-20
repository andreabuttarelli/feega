# GPU canvas: decode in a worker, upload within 4 ms per frame

On the 82-node canvas the reveal gate (1.5 s) usually ran out: all 73 textures had arrived
~0.5 s after the scene started, but decoding (`createImageBitmap`, ~220 ms synchronous in
WebKit) and uploading (`copyExternalImageToTexture`, ~360 ms) all ran on the main thread
in the same few frames, stalling them for 150–380 ms each.

- `bitmap-decode.worker.ts` fetches and decodes (fitted to the device's decode edge) and
  transfers the `ImageBitmap`. `createDecoder` falls back to the main thread when no
  worker can start or the worker fails.
- `upload-queue.ts`: decoded bitmaps wait in a queue; each frame the scene uploads
  (`renderer.texture.initSource`) nearest-to-viewport first until 4 ms are spent, at least
  one per frame.

The reveal rule is unchanged: the gate still waits for every visible node's preview, it
just gets there sooner.

Production build, WebKit iPad Pro 11, heavy canvas, before/after interleaved, median of 3:

| | frames stalled after start (sum of >80 ms gaps) | reveal wait | interactive |
|---|---|---|---|
| before | 796 ms | 1411 ms | 5245 ms |
| after | 0 ms | 945 ms | 4630 ms |
