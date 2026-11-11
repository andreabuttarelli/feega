# Canvas: the blur fetches half the texels

Each blur pass read every texel of its kernel with `textureLoad` (up to 64 taps per side, then a
stride that skipped texels). Now neighbouring taps are merged into one hardware-bilinear fetch at
their weighted offset (`kernel.rs gaussian` returns offset + weight pairs), so a kernel of `n`
taps per side costs about `n/2` fetches, and the stride only starts past 126 texels instead of 64.

Bilinear filtering is only exact on premultiplied texels, and filter textures store straight
alpha. So the blur runs `Premultiply` → `BlurPremultiplied` (horizontal) → `Blur` (vertical, back to
straight): one extra cheap pass for half the fetches. Ops declare their storage in `SOURCES`. The
GL fallback keeps two `texelFetch`es per merged tap (its textures are `NEAREST`), same cost as
before.

Tests: `tests/kernel.rs` (half the taps, weights sum to one, weighted offset), `tests/blur_golden.rs`
compares against images rendered by the old kernel: max channel difference 1–2.
