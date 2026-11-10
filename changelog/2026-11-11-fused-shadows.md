# Canvas: drop and inner shadows in one GPU pass

After #1924 the filter passes were still about 70% of the GPU time to raster imported landing
pages, and almost all of it was shadows: CSS `drop-shadow` ran alpha, two blurs, flood, offset and
two composites; the effects' SVG drop-shadow and inner-shadow graphs ran six to eight passes, each
over the whole layer region. Imported cards carry several shadows each.

Now:
- CSS `drop-shadow` and the SVG graph the drop-shadow effect builds (optional `feMorphology`,
  `feOffset`, `feGaussianBlur`, `feFlood`, `feComposite in`, `feMerge`) run the blur on the source
  (its alpha is the same) and one `Shadow` pass that offsets, tints and composites.
- The inner-shadow graph (`feOffset`, `feGaussianBlur`, `feComposite out`, `feFlood`,
  `feComposite in`, `feMerge`) runs the blur and one `InnerShadow` pass.
- The graphs are recognised in one place (`effect_shadow`, `inner_shadow` in `filters.rs`);
  anything else still goes through the general SVG graph. WGSL and GLSL both have the two ops.

Tests: pass counts per graph (`tests/shadow_passes.rs`), pixel values captured from the old chain
(`tests/effects.rs`, GPU feature), each within 2.

Measured (landings, CPU 1x, tile probe, GPU ms to done, +4 level): zoom 1.5 524 → 335, zoom 0.5
427 → 243; filter share at zoom 1.5 364 → 174 ms. Settled screenshots, tiles off and on, zoom
0.12/0.5/1.5/4: max channel difference 3 on at most ~32 pixels.

Discarded: downsampled large blurs. After #1924 blur is about 115 of 1500 filter megapixels per
level; not worth the extra resize passes.
