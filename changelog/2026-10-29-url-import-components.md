# Import from URL: repeated blocks become components

Spec `docs/specs/url-import.md` (Components).

- Before: every repeated card, logo or button arrived as loose layers.
- Now: `repeatedOf` marks repeated subtrees as Figma-style `INSTANCE` nodes pointing at the first copy;
  `restMessage` maps `componentId` to `symbolData`. The Figma scene reads `Name / Prop=Value` as a
  variant. Instances are diffed with the main (`instance-diff.ts`) and carry overrides; image slots of
  instances fill `overrides[inner].fills`.
- Discarded: a separate "Components" area — the Figma importer keeps the main where the first copy is.
- Found by rendering: a precomp inside an auto layout inside a main is drawn without its content, and
  geometry overrides inside auto layout shift text. Both cases are excluded rather than patched in the
  renderer.
- Fixtures (mains / linked instances): linear 5 / 11, stripe 5 / 1, vercel 1 / 1. Fidelity unchanged on
  linear and vercel; stripe moves by 0.00005, the same as a run with no components (network images).
