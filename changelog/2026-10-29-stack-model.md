# Stack: the auto layout container, read as a kind

"Add auto layout" becomes "Wrap with stack". This entry is the model half; the menus, inspector
and canvas wiring land in the next PR.

ADR 0027 records the choice: a Stack is not a new component. It is the container that already
existed — a rectangle `Shape` with `autoLayout` — and `layoutKind(clip)`
(`packages/motion-core/src/motion/layout/stack.ts`) is the one table that reads it as `Stack`
(horizontal, vertical) or `Grid`. Nothing is written: every container saved before today shows as
a Stack (`elementName`) the first time it is read. Discarded: a `Stack` component (a fork of
`Shape` for one field) and a stored `kind: 'stack'` (a second truth next to `autoLayout`).

What changed in behaviour:

- `Align.Stretch`: children that hug the cross axis take the line, fixed ones keep their size,
  like CSS `align-items: stretch`. Codegen writes `stretch`.
- `wrapWithStack` always wraps, even a lone clip that already has children (before, that clip
  became the container in place). When the selection shares a parent stack, the new Stack takes
  their place in its order; boxes are read from the laid-out doc, not the stale stored props.
- `removeStack` unwraps: children keep the boxes the layout gave them, move to the Stack's
  parent and order; the Stack and its empty lane go. The old "turn layout off, keep the
  container" is `freezeLayout`, still used by `set_auto_layout off`.
- A new lane is named "Stack", not "Auto layout".
- `freeStackFit`: a free element whose doc is one Stack resizes its node and stage to the box the
  Stack hugs after every recorded edit (`FIT_BY_KIND[Element]` in `text-autosize.ts`, next to the
  free text fit). Children, text size and stroke widths keep their pixels; other stage-relative
  props (effects) still follow the stage, as they do when an element is resized by hand.

Renames (moves only, own commit): `wrapInAutoLayout` → `wrapInStack`, `addAutoLayout` →
`wrapWithStack`, `leaveAutoLayout` → `leaveStack`, `removeAutoLayout` → `freezeLayout`.
