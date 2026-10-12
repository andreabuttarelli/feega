# Parallax grid motion template (draft)

Hand-made template: 3–6 columns of pictures/videos fill the frame and scroll under a virtual smooth scroll (video only, no input).

- **Scroll** is a pure function of t: `segments` (pure in-out expo moves with rests, the loop seam mid-rest) or `continuous` (linear).
- **Speeds differ by tile count**, not by rounding a factor: each column travels a whole number of its own periods per loop, so wraps and the loop seam are exact while speeds still differ finely.
- **Motions** live in one table (`MOTIONS` in the model): parallax, alternate, stagger (centred delays inside the rest, so the seam holds), zoom (column widths by depth + slow push), drift (linear).
- No corner radius field: house shape rule (sharp or full circle).
- Step 1 only: no library preview yet.
