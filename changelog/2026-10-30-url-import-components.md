# URL import, phase 3: component kit, and phase 2 fixes

Phase 3 of 4 (phase 1 sections #1640, phase 2 tokens #1642).

## Component kit (`component-kit.ts`, `component-sheet.ts`)

- Mains get properties from their direct layers: text (`Label` for buttons and links, `Title`,
  `Text`, `Text 2` otherwise, top to bottom) and boolean toggles for a direct picture or icon group.
- Buttons, links and nav links whose top layer fill is bound to a site colour get `State` variants:
  `Default`, plus `Hover` and `Pressed` copies (new clip ids) bound to `<Var> hover`/`<Var> pressed`,
  a 10 %/20 % shade toward black (light colours) or white (dark ones).
- `repeated.ts`: buttons and links of 2–3 distinct heights split into `Size` variants. Other blocks
  never do: logo marquees had five heights and became `Size 1..5`.
- Instance colour overrides (`color`, `fill`, `fills`) that are a member of, or within ΔE 1.5 of,
  the variable the main layer is bound to are dropped: the instance inherits the binding instead
  of a literal. Override colours are never sampled, so a near twin was not a member.
- `componentSheet`: one `Components` frame per page slice with mains, beside it, a row per set.
  After placement `importPageAt` rewrites each page with `homed(doc, sheetId)`, so the sheet is the
  mains' home (`linked-mains`). The sheet has the slice's size because frameless comps take the
  host's frame; cropping it needs comps with their own frame.
- Only with tokens on (the design-system mode).

## Phase 2 fixes

- Primary: was the most used chromatic fill; the `button` flag on samples meant "inside a host
  named button" and caught page-sized fills (Stripe got green, Vercel white). CTAs are now read
  from the page tree: `a`/`button` nodes with one solid fill, one text, at most 64 px tall, weighted
  by area times lightness contrast with the page background. Tiers: chromatic CTA, brand palette
  colour on the page, any CTA, then the old rule. Fixtures: Stripe `#533afd`, Vercel `#171717`,
  Linear `#5e6ad2` only with its brand palette (its CTAs are grey; without a brand, `#e5e5e6`).
- Colour roles claim paints, not clusters: one colour can be Primary for fills and Text for text.
- H1 is the style used by an `h1`, picked before Display.
- `Colour N`/`Text N` replaced by hue or painted role (`Green`, `Surface 2`) and by heading level,
  case or size (`H4`, `Label`, `Body large`).
- Borders: `solidOf` read stroke stacks as fills and never matched. A single solid stroke now binds
  `stroke`; `resolveVariables` writes a bound `stroke` into the stroke stack (`PAINT_STACKS`). The
  page background was already bound (test added). Radii still unbound: corners are fractions of
  the shorter side, a px variable needs a per-clip conversion.
- `/start` runs Brand before Import, so `findSiteBrand` finds the brand on the first import.
