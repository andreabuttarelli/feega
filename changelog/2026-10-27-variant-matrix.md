# Variant matrix and preferred swaps

Variants (2026-10-22) had one key at a time and no way to see the set. Figma sets are a grid over
several properties, and instance swap offers a short list of suggested components.

- `variants.ts`: `defineVariantProp` adds an axis (Size = S, M, L) and copies the main for every
  missing combination, up to 64 per set; `variantMatrix` lists every combination with the
  composition behind it or `null` for a hole; `setVariant` switches several axes in one swap, and
  `pickVariant` is now one call to it. Copies keep inner clip ids, so overrides survive.
- `preferred` on a swap property definition (`setPreferred`): suggested components, listed first
  in the instance dropdown. A suggestion, not a restriction: any component still swaps in.
- Instance inspector: `VariantMatrix.svelte` (grid, click a cell to switch, add a property by name
  and values) and a preferred toggle per swap property.
- Agent: `component` actions `define-variant`, `set-variant`, `set-preferred`.

Discarded: a separate set object. Mains sharing `component.set` stay the only storage.
Not done: removing an axis or renaming a value from the panel.
