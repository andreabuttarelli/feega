# Effect atlas: one vello render per sheet of effect layers

Every effect layer (body, mask, matte, backdrop, composited) was its own
vello render + submit: ~40k renders per sharp-zoom run on the landings wall.

- `Gpu::paint` now packs each layer into a cell of a 2048 px sheet
  (`atlas::Packer`, shelf packing), clipped to the cell, base colour drawn
  as a rect. The cell is copied into a pooled texture in the filter
  encoder, so filter/mask/blur passes run unchanged and batched.
- A sheet is settled (rendered, then the filter encoder submitted) when:
  a new layer reads an image placed since the last settle, the sheet is
  full, the scene passes half of vello's bump budget, or any direct render
  runs. Sheet size and fullness bound GPU work per submit.
- Layers wider than the sheet still render alone. `Engine.atlas = Off`
  keeps the old path; the parity test compares both.

Measured (sharp-zoom, landings wall): effect renders 39.8k → 2.95k desktop,
blur over legs 8.4 → 6.9 s, worst frame 117 → 69 ms; THROTTLE=4 blur
14.6 → 11.5 s, worst 401 → 250 ms.

Not done: filter passes still dispatch per layer (not one dispatch over the
atlas); fit/overview submit-splitting not measured here.
