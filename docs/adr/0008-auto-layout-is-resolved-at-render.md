# Auto layout is a field on a parent clip, resolved into plain boxes before render

Context: a frame (`MotionDoc`) places every visual clip by hand: `props.x/y` (centre) and
`props.width/height`, fractions of the frame. Lining up a row of buttons, a card with a title and
a caption, or a list that grows when a word changes means moving every clip again. Design tools solve
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

## Amended 2026-11-16: hugged text is sized by the font, not by the estimate

The GPU canvas had already moved to the font's own metrics: `prepare` lays out with `shapedText`,
the shaper the painter draws with (fontkit over the real font files, kerning included). The HTML
renderer kept `textExtent`, so a server still or video, laid out by the estimate, disagreed with the
canvas the user had just looked at. Measured against Chromium over 756 cases (7 fonts, 3 sizes, 2
weights, 3 trackings, 7 scripts; `npm run test:text-metrics`): the estimate is off by 9.9% at the
median and 45–52% at p90/max (CJK at 0.5 em, monospace, emoji, any weight or family); the shaper
is within 0.7% for every non-emoji string. The "few px for unusual fonts" this ADR accepted was
the common case.

Server renders (`drawStill`, `drawFrames`, render-farm and batch requests, selection export) now
compose with `withShapedText`: the same fonts the canvas loads, fetched as a browser fetches them,
shaped by the same code. It is still deterministic and still no measurement cache: the input is
the font file, not whichever browser opened the editor last. `textExtent` remains the fallback when
a face cannot load, and the measure for callers that have no fonts at hand (editor ops, the code
export's own layout pass, compose in the browser players).

Emoji are the exception the shaper cannot close: Chromium draws them with the system's emoji font
(Apple Color Emoji on macOS), the shaper with Noto Emoji, so a line of emoji differs by 5–10%
between machines' browsers. Not fixable by measuring; the guard leaves them out and says so.
