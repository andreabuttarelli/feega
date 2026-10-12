# Media cloud template

Hand-made template from reference `refs-batch2/5-media-cloud-white`: white ground, 150 small
picture/video tiles in 3D, camera flying forward through them; optional title at the end.

- Per-tile depth `FAR - range·frac(phase + passes·t/L)`: seamless loop by construction; a tile
  wraps only at opacity 0 (fades in far, out near or when projected size passes 0.3).
- Placement: R2 low-discrepancy scatter + seeded hash; centre tiles larger (`centreBoost`).
- Projection done in JS, tiles sized in px with 2D translate (crisp, no upscaled layers). No
  WebGL: 150 plain elements are cheap.
- Title clears tiles behind it with a soft 0.2 mask; camera drift is a periodic sway.
- Step 1 preview only (16:9); 9:16/1:1 covered by model tests, not rendered yet.

Near tiles no longer fade while large ("ghost tiles"): each tile is placed
far enough off the camera axis to leave the frame before it gets close, so
the near fade only ever hits tiles already out of view. The size-based fade
is gone.
