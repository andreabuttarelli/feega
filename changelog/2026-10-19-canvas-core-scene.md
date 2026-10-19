# The canvas starts moving into the core

ADR 0020: the infinite canvas becomes a display list drawn by `gpu-core`, every node drawn live,
no snapshots. First piece: `canvasScene` composes frames' `drawFrame` lists through the camera
(culling, per-frame scissor, selection ring), and `?renderer=core` is parsed (still loads the
current GPU canvas until the scene is wired). Discarded: hit-testing in Rust (boxes would cross
the wasm boundary twice for nothing).
