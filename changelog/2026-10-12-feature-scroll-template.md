# Feature scroll template (step 1, draft)

Third hand-made template: opening title, then a column of feature lines (same font) scrolls up,
readable first, then accelerating into a blur as the list repeats, then braking (expo) into a
centred closing title. Lines are out of frame on landing, in every aspect.

- **Speed is a closed-form profile**, not keyframes: smoothstep ramp, constant reading speed,
  power-curve acceleration, expo brake. Peak speed is solved so the brake ends exactly on the
  closing title; `repeat` (distance) sets it, so there is no separate peak field.
- **Motion blur is vertical only** (SVG `feGaussianBlur` `0 σ`), σ proportional to per-frame
  displacement, so the fast phase smears instead of strobing.
- Closing gap is frame-aware (`ay + pitch`), so 9:16 also clears the lines.
- `leave` (not `loop`: lint reserves it for p5) fades the closing title so frame L = frame 0.
- Based on #425's `custom-template.ts`.
