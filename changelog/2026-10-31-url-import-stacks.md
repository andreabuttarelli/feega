# URL import: stacks inferred from geometry (draft)

Imported pages were absolute below the section level. `page-stacks.ts` now
cuts every frame XY-style: children that do not overlap along an axis become
a stack; uneven gaps nest (split at the largest gap); grids become rows;
rows spanning the column spread (space-between) and fill; frames as wide as
their parent fill. Overlaps, opacity, effects, clipping, vector drawings stay
absolute. Gaps and even paddings bind to spacing variables.

Frames holding text are left fixed: an auto-layout text in the canvas hugs,
and re-measured text moved whole sections (linear fold 0.989 -> 0.772).
Fixed-size text (`textAutoResize: NONE` -> `TextSizing.Fixed`) is now mapped,
but stacking text with it still lowered SSIM, so it is not used here.

Fidelity (PLAIN shape, same capture) still drops on full-page SSIM:
linear 0.989/0.971 -> 0.985/0.969, stripe 0.969/0.888 -> 0.981/0.865,
vercel 0.980/0.972 -> 0.980/0.950 (fold/full). Not merged for that reason.
