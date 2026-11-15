# Poster readback wraps the core's bytes

`rasterOf().poster` built its `ImageData` with `Uint8ClampedArray.from(bytes)`, an element-wise
copy of every pixel the wasm core had already copied into a fresh `Uint8Array`. It now wraps
that buffer as a view: ~3 ms saved per 1 MP poster, zero extra bytes.

Found in the TS ↔ gpu-core boundary audit. Left alone: per-frame `render_tally` JSON (small,
~20 keys), the video → 2D canvas still before upload (needs browser proof before removal).
