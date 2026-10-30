# URL import, phase 3 follow-up: eight weak spots

Found by importing stripe, linear and vercel and using the result.

- **Radii bound** (`corner-radius.ts`, `token-bind.ts`, `variables.ts`). Corners were baked into
  path shapes, so `Radius M` existed and nothing used it. A path that is a uniform rounded rect of
  a radius in the scale becomes a `rect` shape bound to the new `radius` target: a px number
  variable, resolved against the clip's own short side (`roundness = px / short`). The target needs
  the scope's frame, so `resolveVariables` now walks comps with their frame. Non-uniform corners
  stay paths.
- **Components frame** (`component-sheet.ts`). Packed as a wrapped grid aiming at landscape, no
  longer one row per set. The ask was to size the frame to its content; not done: comps carry
  positions as fractions of the frame and pages follow the sheet by copying comps
  (`linked-mains.ts`), so a different size would distort every instance. Left for an engine change.
- **Panel listed twice** (`canvas-components.ts`, `project-components.ts`). The server listed frame
  by frame; a comp held by the sheet and followed by the page appeared twice. One pass per canvas,
  and a comp whose home frame is present is skipped.
- **Logos** (`repeated.ts`): all Logo sets fold into one with `Variant=N`, instead of Logo, Logo 2...
- **Nested texts** (`component-kit.ts`): properties read every text of the main, not only top level.
- **CTAs** (`repeated.ts`): painted button-like nodes group by structure (layout, text count,
  icon), ignoring text size, and need no style repeat. Stripe's CTAs were one per style. CTA
  detection for `Primary` accepts marked names (`Button 2 / Style=...`).
- **Tint names** (`page-tokens.ts`): L* <= 25 is Navy (blue) or Ink, L* >= 80 is Tint.
- **State shades** (`component-kit.ts`): Hover and Pressed widen from 10/20% until they move
  6/12 Lab units from the base.
