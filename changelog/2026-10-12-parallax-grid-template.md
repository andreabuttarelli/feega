# Parallax grid motion template (draft)

Hand-made template: 3–6 columns of pictures/videos fill the frame and scroll under a virtual smooth scroll (video only, no input).

- **Scroll** is a pure function of t: `segments` (pure in-out expo moves with rests, the loop seam mid-rest) or `continuous` (linear).
- **Speeds differ by tile count**, not by rounding a factor: each column travels a whole number of its own periods per loop, so wraps and the loop seam are exact while speeds still differ finely.
- **Motions** live in one table (`MOTIONS` in the model): parallax, alternate, stagger (centred delays inside the rest, so the seam holds), zoom (column widths by depth + slow push), drift (linear).
- **Five library entries** (Parallax, Alternating, Staggered, Depth, Drifting columns) from one `VARIANTS` table in `template.ts`: same component, only the default motion differs; each has its own preview.
- **Expo renormalised** in the grid (`glide`): the shared curve steps 2^-11 at both ends, which the smoothness check flagged as pops at every move start/stop in 9:16 and 1:1.
- Odd columns run the pictures reversed from a spread offset, so neighbours don't repeat side by side.
- No corner radius field: house shape rule (sharp or full circle).
