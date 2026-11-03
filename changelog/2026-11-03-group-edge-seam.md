# Groups no longer show a seam inside their edges after ⌘G

Closes the open item left in `2026-11-02-multi-select-box-shadow-edge.md`.

- **Symptom.** Right after ⌘G a group showed a 1 px (2 device px) canvas-coloured column inside
  its outer left and right edges. It moved with pans and drags; zoom or reload cleared it.
- **Cause: not the GPU canvas.** The column was the `outline: 1px solid var(--ui-line)` of the
  `MotionPreview` stage mounted inside the group's DOM node (`MotionNode` mounts the player to
  capture the poster). On a bare element the backdrop is transparent, so only the outline showed.
  The player box is aspect-fitted inside a node 2 px smaller than the group (the `.motion`
  transparent border), so the outline landed 2–3 px inside the edges, its top and bottom rows
  clipped by the stage `overflow: hidden`. Zoom and reload unmount the player, hence the "fix".
- **Fix.** `.stage[data-backdrop='transparent']` draws no outline. Only `MotionNode` passes a
  transparent backdrop, for bare elements on the canvas.
- **How it was found.** A log of every call into gpu-core, replayed natively with a real GPU
  painter, drew the damaged rects correctly; re-putting the group in the browser left the column
  in place; hiding the node's `motion-node-stage` removed it. Chasing damage-rect rounding in
  gpu-core was the wrong layer.
- Test: `motion-preview-backdrop.test.ts` compiles the component and checks the see-through rule.
- **Unrelated, still red under `--features gpu`:**
  `a_cached_frame_draws_the_same_pixels_as_the_expanded_one` (worst channel 89) and
  `an_evicted_raster_frees_its_texture`. Not added to CI: the ubuntu runner has no GPU adapter,
  and both tests are red.
