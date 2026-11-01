# URL import: interactive parts and change-to-variant links

Imported pages were frozen pictures of their dynamic parts: a closed FAQ
came in closed with its answers hidden, tabs showed one panel, hover was
a guessed shade on buttons.

- `page-patterns.ts` is the registry (details, aria-expanded disclosures,
  tablists, switches/checkboxes, Swiper). The walker reads every other
  state of each part after the default walk, unfreezing the page for a
  beat, blocking navigation, dropping focus; a state the page does not
  take is skipped (feega.app's Framer tabs ignore a synthetic click once
  frozen, so they stay plain).
- `pattern-sets.ts`: one component set per part, the other states as
  hidden mains removed after planning, triggers as `change_to` links.
  Parts are hidden from `repeated.ts` so FAQ items are not one main.
- New prototype action `change_to` (motion-core); the player swaps per
  instance by precomp path; the inspector offers the set's variants.
- `page-hovers.ts` + `hover-states.ts`: CSS `:hover` rules become Hover
  element states with the page's transition; `component-kit` skips the
  shaded Hover/Pressed variants for a main that has a real one.
- Player states now play inside groups and instances; a text `fill`
  state writes `color`.
- Defects found on the way: a hidden frame's children still drew, and a
  hidden page frame with children broke the still render (dev crashes on
  docs.astro.build); frames past 8192 px drew black in the player (the
  WebGPU surface default), now they draw in HTML.

Fidelity unchanged on feega.app (v4 capture: 0.9590 fold / 0.9529 full,
same as dev). Discarded: a toggle action; JS hover through pointer
events (the freeze gates them).
