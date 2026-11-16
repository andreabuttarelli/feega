# GPU texture budget on phones

Phones killed the canvas tab with no JS error. A census of live WebGPU textures on the user
canvas copy (iPhone 14 emulation, CPU 4x) found ~420 MB held, 256 MB of it one 8192x8192
texture: vello's image atlas. It grows to fit every picture of a draw (cached layers count as
pictures too) and never shrinks. A resized atlas also stayed alive in vello's image pool.
Breakpoint views were not the cause: on a phone none are built on load.

Changes:
- vello (vendored): `Renderer::set_image_atlas_max` caps the atlas and shrinks it at once,
  dropping residents that no longer fit so they upload again. The image pool destroys images
  of 16 MB or more instead of keeping them.
- gpu-core: `WebCore::set_image_atlas`.
- `BUDGET` in `memory-budget.ts`: phones get a 4096 atlas, 1024 px pictures (sixteen fit), and
  64 MB each for frame textures and tiles, 192 MB configured in all (`PHONE_GPU_BYTES`).
  Desktop is unchanged; its 8192 atlas is vello's default.
- Component previews draw on their own core; they now take the same picture side and atlas cap.

Measured on the user canvas copy, iPhone 14, CPU 4x (3 runs each, live texture MB):

| | load | after zoom | zoom fps | TTI |
|---|---|---|---|---|
| before | 422 | 478 | 50–55 | 10–17 s |
| after | 195 | 247 | 51–57 | 11–15 s |

The zoomed total still exceeds 192 MB: tiles hold ~90 MB against a 64 MB tile budget because
spare, fallback and lifted tiles sit outside it, and ~66 MB of frame layers on screen are never
evicted. Those are the next cut.

Phone zoom flicker check, 9 runs: 0 dips, 60 fps.

Discarded: lowering the device's max texture dimension instead. It caps every texture, not just
the atlas, and would break tall frames.
