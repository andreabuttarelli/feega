# Selection bar v3

**Before.** The bar from #1398 forced the actions onto a right-aligned second row
(`flex-basis: 100%`), drew a divider between rows and borders between groups (one landed at
the left edge of the wrapped row), inserted a separate grey Stop button while running, mixed
outlined triggers with a borderless price and a filled button, and showed a disabled Generate
as a pale accent with no tooltip (a `disabled` button gets no pointer events).

**Now.**

- One row: `[model · settings · ×N] [price Generate] [actions ⋯]`. It stacks into two left-aligned
  rows only when the measured content is wider than the node (min 340px): `stacked` is derived
  from the two groups' widths, so the bar hugs its content in both layouts. CSS `flex-wrap`
  was discarded: a wrapped flex box keeps its max width and leaves dead space.
- All triggers are ghost (no border, hover fill), changed in the four menu components, which
  only the bar uses.
- The run button is one control: Stop with a square and a spinning ring while running
  (`data-testid="stop-run"` kept), `aria-disabled` with the muted wash and a reason tooltip
  when blocked. No dividers.
- `toolbarSlots` still decides which actions are pinned.

