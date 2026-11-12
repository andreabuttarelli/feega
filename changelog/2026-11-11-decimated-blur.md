# Canvas: wide blurs run on a smaller image

A blur of σ device pixels ran two passes at full resolution with ~3σ taps per side; above 64 taps
a stride skipped texels and aliased. Following vello (`gaussian_blur.rs plan_decimated_blur`), an
isotropic blur wider than σ = 2 now halves the image with a [1, 3, 3, 1]/8 filter (`Down`, four
bilinear fetches) until the σ left is ≤ 2 (at most 5 levels), blurs there with ≤ 13 taps, and
comes back with one bilinear `Up`. `kernel.rs decimation` keeps the variance: what the
downsamples (0.75 per level, in that level's pixels) and the upsample (1/6) add is taken out of
the blur, so the result keeps the requested σ. Anisotropic blurs keep the full-size path.

`Runner::run` now takes the output size, so a pass can change resolution.

Quality against the old full-size kernel (`tests/blur_golden.rs`): σ 2 / 6 / 20 / shadow 35px,
max channel difference 1 / 3 / 4 / 3, SSIM 0.9999 / 0.9985 / 0.9952 / 0.9974. The effect
shadow pixel tests in `tests/effects.rs` stay within 2.
