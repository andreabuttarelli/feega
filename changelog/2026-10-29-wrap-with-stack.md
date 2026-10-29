# Wrap with stack: one action, four surfaces

UI half of ADR 0027. "Add auto layout" (⇧A) is now **Wrap with stack**; **Remove stack** (⌥⇧A)
unwraps. ⇧A used to toggle: on a lone container it turned layout off. Now ⇧A always wraps (a
second ⇧A nests) and removing is its own command.

One registry drives every surface, per the user's requirement:

- `frame-inspector.ts` `BAR_OPS` holds the run and the `shown` rule (`RemoveStack` only for a lone
  stack). `elementMenuIds` (canvas right-click on an element), `elementToolbarActions` (selection
  toolbar "…"), `layerMenuActions` (Layers row menu) and `frameBarActions` (right bar "…") all
  filter by it. `stack-surfaces.test.ts` asserts each surface for a text and a stack.
- `elementMenuIds` replaces the static `FRAME_ELEMENT_MENU` as the element context menu: items are
  now hidden when their `shown` rule says no (before, e.g. Ungroup was listed on any clip).
- The Layers menu was masks only (`LAYER_MENU`, deleted); it now runs registry actions through a
  new `VideoSide.run` → `runFrameAction`, plus a local Rename.
- The selection toolbar takes `elementActions` for picks inside a frame; a toolbar click on one of
  them goes to the element path, every other id keeps its node-level meaning.

Free elements: one free element wraps inside its own doc (its clip is already picked). Several go
through `stackElements` (page action, canvas op `stack_elements`) which merges them into one
element node, wraps, and sizes the node with `freeStackFit`. Groups are refused (their members
live in other nodes). The canvas tile arranger keeps its menu entry as "Stack tiles", no key.

Inspector: `Section.Stack` sits under Layout in `SECTION_ORDER`, shown for a stack or a child of
one; StackSection lost its own shell, the remove button is the section action. Align is the 3×3
grid; a new Distribute row holds stretch, baseline and the spreads (five icons overflowed one row).
Header and Layers name and draw a stack from `layoutKind`.

MCP: `remove_stack` motion tool. The renames of the old tools come in the codegen/MCP PR.

Seen in the browser (test account): text in a frame and a free text wrapped from the menus and ⇧A.
Text inside a stack still renders blocky on the GPU canvas and can overflow its hugged width: the
hug width is the `textExtent` estimate (ADR 0008), not the shaped text. Not addressed here.
