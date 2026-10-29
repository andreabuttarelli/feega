# Hover and click pick the same element

- Hover outlined the deepest clip (`picker.pickHeld`), a click selected the top-level child
  (`chainTarget` with `Reach.Top`): what the outline promised was not what got selected.
- `chainTarget` became `pickTarget` (`frame-scope.ts`), the one depth rule. Hover now goes
  through `elementAt` like the click; `reachOf` maps Cmd/Ctrl to `Reach.Deep` for both.
- Inside a container, a pointer outside it climbs one context at a time (sibling of the
  picked element's container) instead of jumping to the frame's top level, as Figma does.
- Table test `pick-rule.test.ts` on a frame > section > card > text doc.
