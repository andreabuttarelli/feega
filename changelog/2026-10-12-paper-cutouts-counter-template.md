# Paper cutouts counter motion template (draft)

Hand-made template: three crumpled paper cutouts float in a grey studio — an orange cutout holding a picture, a deep purple panel where a counter grows line by line (each line bigger, the newest rolling up from the previous value), and a white sheet where a line sketch draws itself. Corner labels and a round badge carry a fictional brand.

- CSS 3D only: each card has its own `perspective()` (no `preserve-3d`, which the seek check distrusts); the panel stacks above by z-index.
- Crumple is two jittered triangle meshes per sheet; each facet is lit by its tilted normal against a fixed light, so the shading changes as the cards sway. Torn edges are seeded `clip-path` polygons.
- Sway is periodic over the clip length, the list and the sketch empty out before the end: seamless loop.
- Layouts for wide, square and tall frames.
- Step 1 only: one 16:9 test render at 60 fps, zero smoothness jolts.
