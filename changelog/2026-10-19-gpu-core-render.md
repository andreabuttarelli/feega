# gpu-core-render: headless native frames

`gpu-core-render` was a pair-wise debug tool (`list.json out.png …`). It is now the headless
renderer the desktop app can call:

```
gpu-core-render frames.jsonl --png=<dir> [--root=<dir>]
gpu-core-render - --raw | ffmpeg -f rawvideo -pix_fmt rgba -s 1920x1080 -r 30 -i - out.mp4
```

One display list per line (what `drawFrame` writes); fonts (`faces[].url`) and pictures (`src`)
resolve against `--root`, by default the folder of the input. `--raw` streams RGBA8 frames to
stdout for an encoder and refuses a frame whose size differs from the first. Skipped items go to
stderr per frame. The loop lives in `gpu_core::frames` so it is tested without a process.

- Deterministic: the same lines give the same bytes, across frames and across renderer instances
  (`tests/frames.rs`, behind `--features gpu`).
- `facesLoader` returns the TS face book plus the faces the native core needs, so a prepared doc
  exports with text items instead of flattened glyphs.
- `npm run bench:gpu-native -- --docs=<kind.json,…> --frames=4` builds the book (fonts fetched
  with a browser user agent: Google otherwise serves different TTF files than the browser gets),
  renders it natively and compares with the frames `bench:gpu-parity --under=core-export` saved.
  On the text and shape parity kinds native frames match the web export at SSIM ≥ 0.9998.
- Video frames are not decoded natively yet: a video item is skipped by name.
