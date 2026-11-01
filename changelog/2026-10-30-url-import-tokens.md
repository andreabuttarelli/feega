# URL import, phase 2: shared styles and variables

Phase 2 of 4 of the imported design system (phase 1: sections, #1640).

## Font fix

`TREE_SHAPE` in `import-url.ts` was a plain `z.object`: zod strips keys it does not name, so
`fonts` (and `snaps`) captured in the browser never reached `urlPlan`. Imported text fell back to
catalogue stand-ins. Both are named now and the shape is `.strict()`: an unknown field makes the
tree `unreadable` instead of vanishing. Test: the page font reaches `importFont`, is registered in
the doc as an uploaded family and used by the text.

## Tokens

- `page-tokens.ts`, pure: clusters colours (Lab ΔE ≤ 1.5 merges near-duplicates, members kept) and
  names them from one role table (`COLOUR_ROLES`: Background, Text, Primary, Surface, Text muted,
  Border, Accent, then Colour N). Text styles are exact combinations of family, weight, size,
  leading, tracking and case, kept when used twice or inside a heading, named by `TEXT_RULES`
  (Body, Button, Display, H1–H3, Small, Caption, then Text N). Shadows, radii and spacing become
  scales. No model call.
- `token-bind.ts`: samples the built frame docs (every composition, image placeholders excluded),
  writes a variable collection named after the site (`Stripe/Primary`), text, effect and gradient
  styles (`Stripe Body`), and binds layers whose value is a member: text colour and solid fills to
  colour variables, auto layout gap to spacing, `styleRef`/`effectStyleRef` to styles. Then each
  style is defined again and variables resolved, the same path an edit takes.
- Engine: `defineStyle`, `resolveVariables` and variable removal reached only `doc.tracks`; they now
  walk every composition (`doc-scopes.ts`). Text style size stays in root-frame units and is scaled
  per composition; leading/tracking clear a px `lineHeight`/`letterSpacing`; text styles carry
  `textCase`.
- Brand: when the org has a brand for the same host (`findSiteBrand`, moved out of
  `live-brand-ports.ts`), a token colour within ΔE 8 of a brand swatch takes the brand value.
  Nothing is written to the brand. The `/start` flow creates the brand after the import, so a first
  import from `start_url` is not aligned.
- Option `tokens` (default true): dialog checkbox, route, `import_url` op, CLI `--no-tokens`.

Not bound: borders (the stroke stack has no colour target), radii (corners are baked into paths),
the frame's own background (`doc.background`). They are still listed as variables.

Discarded: colours as colour styles too (two sources for one value); naming with a model.
