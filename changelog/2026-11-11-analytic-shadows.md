# Engine: analytic shadows for rect and rounded-rect bodies

`packages/gpu-core/src/shades.rs` recognises, from the display list alone, the shadows whose body is
a plain rect or a rounded rect with one radius (flattened contour fitted by distance to the rounded
rect and by area), under a rotation/uniform scale (≤2% anisotropy), with no mask or only hard path
clips:

- `Outer`: a solid path with exactly `blur(Npx)` (how `dom/read.ts` writes `box-shadow`).
- `Inner`: the even-odd ring + hard box clip that `innerShadow` writes for `inset` shadows.
- `Behind`: an opaque solid rounded rect with exactly one `drop-shadow(...)`.

These skip the body + mask + blur passes: `Canvas::shade` draws vello's
`draw_blurred_rounded_rect_in` (0.12, `invert` for inset; `fill_blurred_rounded_rect` on WebGL),
inside the same scissor/clip/opacity as a plain path. vello's `std_dev` is the erf width, σ·√2.
Everything else keeps the filter path. Chained drop-shadows, translucent bodies, per-corner or
elliptic radii, groups and SVG `feDropShadow` are not covered.

vello's blurred-rect shader samples pixel corners, not centres: drawn as is, every analytic shadow
sat half a pixel off (max diff 6–7 vs the filter path, 14 on an 8 px bar at σ 2). `Canvas::shade`
shifts by (-0.5, -0.5). Rects narrower than 5σ keep the filter path: vello's approximation is
weakest there (diff 3 at 4σ) and `blur_golden`'s 8 px bar is exactly that case.

Quality vs the filter path (`tests/shades.rs`, σ 6 unless noted): max channel diff outer 2, inner 2,
drop-shadow 1, 12 px bar at σ 2: 2. `effects.rs` and `blur_golden` goldens unchanged.
`examples/shadow_cost.rs` (48 cards, σ 12, 1600×1000, native): shadow cost ~9 ms → ~1 ms.
