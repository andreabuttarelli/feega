# Slider composition and a ratio for every card

**Why.** The user asked for a one-at-a-time slider and for cards that are not all square: each
media gets the ratio the user picks, independent of the file.

**What.**
- `slider` layout (`src/lib/canvas/composition/slider.ts`): variants slide-x, slide-y,
  crossfade, push, peek in one table; hold, fill, peek gap; indicators none/dots/bar drawn as
  solid marks after the cards (`solids` in the layout table). Glides on the Apple-minimal move
  ease, read from `STYLE_EASES` in `style-model.ts` (moved there from `style.ts`: importing
  `style.ts` from a layout made a cycle through the component registry).
- Card ratio (`card-look.ts`): `cardAspect`/`cardRatio` appended to every WebGL layout's
  params with a per-layout default (`cards` in the layout table: 1:1 for most, original for
  stack, polaroid, slider); per card `aspect`, `ratio`, `fit`, `focusX/Y` on the media item.
  Ring and bento keep their own card model.
- Poses stay square boxes; the card is the largest rectangle of its ratio inside the box
  (`cardBox`, shared verbatim with the page script), so no layout can overlap two cards its
  square poses keep apart (`media-aspect.test.ts`). "original" is resolved in the page once the
  file's size is known.
- Shader: cover with focus crop, contain letterboxed, corner radius in card units, solid marks.
- Entry points: node panel `CardsPanel.svelte` (per card ratio and fit, `cardShapePatch`),
  template media field `id@4:5`, `video:id@16:9/contain`, `id@1.3`; template field
  `card_aspect`; agent via the same fields and Composition props.

**Discarded.** Five separate slider templates: one layout with a variant field keeps one
gallery card and one set of agent fields. Scaling cards in the pose functions: "original"
needs the file's size, which only the page knows.
