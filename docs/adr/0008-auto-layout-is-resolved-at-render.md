# Auto layout is a field on a parent clip, resolved into plain boxes before render

Context: a frame (`MotionDoc`) places every visual clip by hand: `props.x/y` (centre) and
`props.width/height`, fractions of the frame. Lining up a row of buttons, a card with a title and
a caption, or a list that grows when a word changes means moving every clip again. Figma solves
it with auto layout: a frame that lays its children out like flexbox. Parenting already exists
(`clip.parent`, transforms compose down the chain), and so do precomps.

Decision: auto layout is two optional clip fields, no new component and no doc migration.

- `autoLayout` on the **container**: `direction` (horizontal / vertical), `wrap`, `gap`,
  `crossGap`, `padding` per side, `justify` (start / center / end / space-between), `align`
  (start / center / end), `order` (child ids). Lengths are px of the frame (or of the comp).
- `layoutItem` on any clip: `width` / `height` sizing (fixed / hug / fill), `min*`/`max*`, and
  `absolute` to opt out of the flow.

Membership is `parent`: a container's children are the clips whose `parent` is the container.
`order` is only the sequence; an id it does not list falls in after, in track order, and an id it
lists that is no longer a child is ignored — so the two never contradict each other. The
container is usually a rectangle `Shape` (its fill is the frame's background); any clip with a box
works. Hidden clips leave the flow.

The engine is one pure function (`src/lib/motion/layout/auto-layout.ts`) that takes a tree of
items in px — size, sizing, min/max, children — and returns a box per laid-out id. It knows
nothing about clips, text or the DOM. An adapter (`withAutoLayout`) turns a doc into that tree,
calls the engine, and writes the boxes back into the children's `props` (and a hugging
container's own). The renderer runs it in `composeHtml` before anything else reads a box, so the
video, the still and the editor preview — which all go through `composeHtml` — see the same
layout, and the editor's selection boxes, measured from the rendered DOM, follow for free.

Text intrinsic size (a text that hugs) comes from a deterministic metrics function
(`textExtent`): lines × size × leading for the height, the longest line × size × an average
advance (plus tracking) for the width. It is an estimate, and the text's own fit keeps it inside
the box when the estimate is short. Discarded: measuring in the player and caching the result in
the doc — it makes the render depend on which browser last opened the editor, and the server
render would have to wait for, or trust, a measurement it cannot reproduce.

Animation: layout places the slot, transforms move inside it. A child's `transform` and its
keyframes (x, y, scale, rotation, opacity) apply on top of its laid-out box, so a staggered
rise-in still works; its box props (`x/y/width/height`) belong to the layout and are not
animatable anyway. A container animates through its own transform: children are parented to it,
so they move, scale and turn with it. A container whose box re-flows over time is out of scope:
box props are not keyframeable in the doc today.

Consequences:

- Old docs are unchanged: no field means no auto layout, and `parseMotionDoc` needs no upgrade.
- Undo, rebase and ops work unchanged: the fields are ordinary clip fields for `diffDoc`.
- The stored box of a laid-out child is overwritten at render. The editor writes the resolved
  boxes back when a clip leaves a container, so it stays where it was seen.
- The estimate can disagree with the browser by a few px for unusual fonts. Accepted until a
  real case shows it matters; the fix then is a better metrics table, not a measurement cache.
