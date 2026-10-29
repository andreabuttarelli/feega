# New elements default to hex colours

New shapes, text, lines, frames and 3D pieces were seeded with brand tokens
(`brand.accent`, `brand.text`, `brand.background`). Users saw "Brand accent" in the
inspector without having chosen it, and a brandless project painted them in the feega
palette.

- One table, `packages/motion-core/src/motion/default-colours.ts`, holds the defaults:
  fill `#D9D9D9`, ink `#000000`, ink on dark `#FFFFFF`, surface `#FFFFFF`. Component
  schemas, the frame surface, custom component params, draw overlay, paste ink and the
  composition headline read it.
- A drawn frame now gets a white surface clip instead of `background: brand`.
- Saved docs are not migrated: tokens already stored keep rendering from the brand.
- Selection colours skip legacy `fill`/`stroke` props shadowed by a `fills`/`strokes`
  stack or by an empty legacy paint (`strokeKind: none`), using the `FILLED`/`STROKED`
  replaces lists; with hex defaults they would otherwise list phantom colours.
- `motionTokens` falls back to the org's oldest brand when the project has none, so Brand
  swatches show a real palette. Swatch titles add the resolved hex.
- Left as is: curated templates (ad templates, trailer, fixtures, ui-ring), the agent
  prompt's brand guidance, renderer fallbacks for legacy `Background.Brand` docs.
