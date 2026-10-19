# Native export: a doc to frames or mp4 headless, no browser

`npm run export:native -- --doc=<doc.json> --out=<file.mp4> [--assets=id=path,…]` (or
`--frames=<dir>`, `--spread=N` for N sampled frames). Node builds every frame's display list with
the same `drawFrame` as the editor (fonts fetched like a browser would, so Google serves the same
variable files), writes them as JSON lines, and the new `gpu-core-export` binary renders them on
native wgpu and pipes raw frames to ffmpeg. Meant for the desktop app later; nothing in it needs
a browser.

- Pictures load from files; video frames are decoded by ffmpeg at the frame the browser shows
  for that time (floor to the stream's frame, then seek half a frame early) and with the
  browser's colour matrix (BT.709 unless the stream says SD). A frame-number test video gave the
  same decoded frames as the browser at 12 of 12 times.
- All or nothing: a frame with anything the core skipped stops the export with its name.
- `files.rs` is shared by `gpu-core-render` and `gpu-core-export`.

Parity, native frames vs the current (HTML capture) export, 6 frames:

| Kind | native | browser core export |
|---|---|---|
| shapes | 0.9992 | 0.9992 |
| images | 0.9979 | 0.9979 |
| video | 0.9987 | 1.0000 |
| masks | 0.9981 | 0.9981 |
| effects | 0.9971 | 0.9971 |
| transitions | 0.9974 | 0.9974 |
| backdrop | 0.9984 | 0.9984 |
| noise | 0.9959 | 0.9959 |
| title | 0.9864 | 0.9864 |
| text | 0.9851 | 0.9851 |
| fonts | 0.9791 | 0.9791 |
| animators | 0.9955 | 0.9953 |

Text still reaches the core as outlines made by the TS painter (in Node). The native core can
already draw glyph runs through gpu-text (#939); emitting runs instead of outlines is the text
painter's side.
