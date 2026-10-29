# Variant sets export as one component

Groundwork for import from code (spec `docs/specs/code-import.md`, ADR 0028).

- Codegen: mains sharing `component.set` export as one component named after the set, with a
  prop per variant axis, dispatching to one implementation per variant (`Button` →
  `ButtonDefault`, `ButtonOutline`). Instances pass the axis values; `Default` is omitted. React
  and Svelte; HTML inlines as before. Before, each variant was its own `Button`, `Button2`.
- `DEFAULT_VARIANT` lives in motion-core `doc.ts`; `variants.ts` reads it from there.
- URL import: `oklch()` colours (Tailwind 4) were dropped by `pageTreeOf`; now painted on a 1×1
  canvas and read back.
- Render: `MAX_COMP_DEPTH` 8 → 24; `compBounds` asks nested instances for their content instead
  of measuring a Precomp host as the whole frame.
