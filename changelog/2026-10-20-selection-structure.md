# Frame selection, auto layout toggle, block reordering

- Cmd+Alt+G frames the selection (`wrapInFrame`): same transparent rectangle container as the
  auto layout wrapper, parented children, no flow. The wrapper is one function now
  (`wrapped`, with a `Container` table). Chat/MCP: `frame_clips`.
- Shift+A on a lone auto layout removes it (`removeAutoLayout`): children keep their parent and
  get the boxes the layout had given them, so nothing jumps. `set_auto_layout off` uses the same
  op (before, it dropped the layout and left the children on stale boxes).
- `arrangeLayers` on several clips: the selection is sorted by layer order (click order no
  longer matters), front/back keep the inner order, forward/backward move the block as a whole
  and a clip does not swap with a selected neighbour. Before, forward on two clips could swap
  them with each other.
- Checked, no change needed: copy/paste of several clips (test added), delete.

Not changed: Cmd+D duplicates in time (the copy starts where the original ends), by design of
`ClipOp.Duplicate`; no spatial offset duplicate.
Tests: `ops.test.ts`, `layer-order.test.ts`, `move-element.test.ts`, `shortcuts.test.ts`.
