# Custom composition layouts: spec interpreter, `layouts` table, resolver

Ticket 9 (spec kind only, user decision 4: no code layouts in v1).

**Spec.** `canvas/composition/spec.ts`: a typed placement table — `place` one of `grid`
(columns, gapX, gapY), `ring` (radius), `line` (gap, axis), `scatter` (spread, depth, seed);
`slots`, `scale`, `tilt`; `animate: [{ prop x|y|z|rotX|rotY|rotZ|scale|opacity, fn sin|linear|ease,
amp, freq, phase {column,row,index} }]`. Any number may be `{ param: name }` of a declared range
param. `specDefinition` compiles it into the same `LayoutDefinition` the 19 built-ins are, with
`transforms(count, params, t)` pure. ≤ 200 slots, ≤ 12 animations, unknown placement or param
refused by zod. Golden test: a spec reproduces `tilted-grid` within 1e-9.

**Resolver.** `layoutOf(layout, spec)`: built-in id → `LAYOUTS[id]`; `'custom'` → the
interpreted spec. The Composition props gain `layoutSpec` (snapshot) and `layoutRef` (row id),
`layout` accepts `'custom'` (`COMPOSITION_LAYOUT_CHOICES`; the pickers keep iterating the
built-ins). `pose.ts` and `bakeComposition` go through `layoutOf`, so preview, render and
server frames draw a custom layout with no database — same snapshot rule as custom effects.

**Storage.** `layouts` table (org-scoped, `kind = 'spec'`, `spec jsonb`, optimistic `version`,
soft delete) — migration `20261008200000_layouts.sql`, not applied. `repos/layouts.ts`,
`/api/v1/org/layouts` GET/POST(write: same name replaces) and `/[id]` PATCH/DELETE. Missing
table → `available: false`.
