# Figma paste keeps the kind of what was copied

Before: every Figma paste on the empty canvas became one frame, even when the user had
copied a single shape. Rule (user): what you copy keeps its kind.

One rule table, `DESTINATION` in `src/lib/canvas/figma/scene.ts`, keyed on Figma node type:
`FRAME` `SECTION` `COMPONENT` `COMPONENT_SET` `SYMBOL` -> frame node; anything else (shapes,
vectors, booleans, text, groups, instances) -> free element, one per top-level node.
Components went with frames because they are frames in Figma; instances are free, as asked.
Positions stay relative around the pointer (`Placement.centre`, offset from the middle of
everything copied).

Pasted over a frame, nothing changes: `figmaIntoFrame` takes `scene.combined` (the lone frame
as itself, otherwise one wrapper) and puts it inside, grouped.

Free elements use today's storage (`elementNodeOf` + `store.create`, kind `element`, or
`group` when the top-level layer builds a group) so the move to a first-class `element` node
type (plans/free-elements.md) only has to change `ITEM_SHAPE` in `move-element.ts`.
`pasteFigmaAt` now returns `frameIds`, and the action `nodes`; the client drops `node_id`
(one paste, N nodes, ids are the server's).

Also in this change:
- Rotation: frames and text keep it (`rotation` on the layer; frame outlines are rotated
  paths, children carry the composite matrix). A rotated text is measured by the union of
  its rotated and unrotated boxes because clip width is capped at 1 of the doc. The
  top-level frame of a frame paste stays upright.
- Fills and strokes are stacks (`fills` / `strokes` props), strokes keep gradients. Angular
  and diamond gradients stay approximated (linear / radial, reported): the core renderer
  draws nothing for an angular fill on a path, which made the whole shape vanish.
- Auto layout: `stackMode`, spacing, counter spacing and wrap, padding, primary/counter
  alignment, hug/fixed sizing, child grow/stretch/absolute map to `autoLayout` and
  `layoutItem` on a container Shape. A rotated auto layout frame falls back to fixed
  positions (reported); grid layout too.

Tests: golden on `tests/fixtures/figma/clip-1.html`, a synthetic elements-only clipboard
(`tests/fixtures/figma/elements.ts`, encoded to a real fig-kiwi archive by `clipboard.ts`),
and `tests/e2e/canvas-figma-paste.spec.ts` (real clipboard, test account only).
