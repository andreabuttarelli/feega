# Text and shortcut audit, first batch

From the round-2 text/shortcut audit.

- **Dragged text box.** `drawClip` sized the type to fill the dragged height. `TEXT_SIZE` now keys
  the size on the sizing: a click (auto width) keeps the click-box fit, a dragged box (auto height,
  fixed) gets 16 px. New texts are left aligned (`align: 'left'` on the drawn clip, not the schema
  default, which existing docs rely on).
- **Stacking.** `Stack.Forward` / `Stack.Backward` step one layer; ties in `z` are separated so a
  step always moves. ⌘] / ⌘[ step, ⌥⌘] / ⌥⌘[ go to the ends; the help card said ⌘] was "to
  front". On a free element the keys used to reorder its single clip inside its own doc (a no-op);
  `wholeElementAction` now routes them to the node.
- **Paste while editing a text** no longer reaches the canvas paste (`clipboardTarget` checks
  `typing`).
- **Comments.** Esc inside the panel closes it and blurs the field; leaving comment mode closes a
  panel that comment mode opened (`openedByPlacing`).
- **⌘R** asks `layersSource` for a rename; the project layout opens Layers and the panel takes the
  request once.
- **Deleting the open canvas** deleted it and left the browser on its URL: the navigation to the
  next page started before the delete's list re-read, which cancelled it. `deletePage` now opens
  the next page once the delete lands, as `addPage` already did. Seen in the browser; the fix is
  not re-verified there (one test canvas per run).
- **Help card** printed `mod Y`: the modifier is now replaced inside combined keys.

Not in this batch: Enter on a group (a click selects the child, Enter on the group did nothing;
the attempt was dropped unverified), undo by word, caret placement after select-all, edge handles
while editing, Motion-mode keys, autolist, the remaining Figma keys, ⌥⌘G on canvas nodes (no
canvas-level frame op exists).
