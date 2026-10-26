# GPU frame polish after the Figma workstreams

Follow-up to #1100/#1101/#1102.

- Selection and hover outlines are quads now (`quadOf` in `gpu/pick.ts`, oriented
  by the clip's own layer), drawn by `quadStyle`: a rotated element gets a rotated
  box and handles. Alt-resize of a rotated single element goes through the
  element's own axes (`dragOne`) instead of the axis-aligned group path, which
  would skew it.
- Boolean ops and flatten refit the kept shape's box to the merged outline: the
  path used to overflow the bottom shape's box, so the outline was narrower.
- Group members (`<group>__<loop>__<id>` in the scene) are pickable: `frame-scope.ts`
  resolves a scene id to its comp path, runs drag/nudge/delete/bar actions on the
  comp view and merges back. ⌘-click (also on a selected body) reaches the
  innermost member, double-click enters the next level, a click next to a picked
  member picks its sibling, Esc goes up to the group. The properties panel still
  shows nothing for a member.
- SVG and text pasted over a GPU frame become one local frame edit
  (`frame-paste.ts`): no free nodes created then moved in, so no blank frame.
  SVG lands as one group. Text takes `brand.text` on a brand background
  (canvas ink on transparent) and grows sideways (auto width).
- An image pasted over a frame uploads and lands as an Image clip in it
  (`upload` action with `drop`, `placeMedia`), no image node.
- Flip: A added flip to `clipActions` and B to `frameBarActions`; ClipBar drew
  both, and the duplicate key threw in Svelte's flush, freezing every overlay
  update while an element was picked. `barActions` dedupes.
- `canvas-element-paste` case 1 picks through the GPU path instead of the DOM
  `selection-overlay`.
