# Stack children are flex items

Product decision: a child of a Stack (ADR 0027) is a flex item. Before, the right bar still
showed X/Y, frame alignment and constraints for it, and the canvas drag moved it freely; the
resolver then snapped it back, so the edit was lost.

- **Model** (`layoutItemSchema`): `widthGrow`/`heightGrow` (fill weight), `widthPercent`/
  `heightPercent` with the new `Sizing.Percent`, and `alignSelf`. All optional, so saved docs
  parse unchanged. `size-entry.ts` reads and writes the typed form (`120`, `50%`, `2fr`,
  `fill 2`, `hug`).
- **Engine** (`auto-layout.ts`): `grow` splits free space by weight, a percent child is given
  its share of the inner box on either axis, `alignSelf` overrides the stack align (and
  baseline). A percent child under a hugging stack falls back to its own size: hug-of-percent
  is circular, CSS does the same.
- **Codegen**: `flex: <w> 1 0`, `width: N%`, `align-self`. Absolute children already exported
  as `position: absolute` inside a relative stack; a test now holds it.
- **Inspector**: `Placement` (free / flow / absolute, `stack.ts`) drives one table in
  `properties-view.ts`: which sections drop and whether X/Y show. Absolute X/Y read relative to
  the stack's box.
- **Canvas**: `stack-drag.ts` decides reorder / join another stack / leave from the pointer,
  with a 16px margin around the own stack before "clearly outside"; the 4px slop and frame-out
  carry are unchanged. `nudgeClips` turns arrows on a flow child into `stepInStack`.
- **Agent**: `set_props` x/y on a flow child is refused (`stackPositionProblem`), naming
  `reorder_stack` and `absolute`.

Discarded: a separate `Sizing.Fill2/3…` enum (weight is a number, not a kind); free move inside
the stack with a snap back (the user asked for never).
