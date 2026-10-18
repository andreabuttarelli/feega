# Built-in icon set

72 common UI line icons vendored from Lucide (ISC, `src/lib/motion/icons/LICENSE`),
converted by `scripts/gen-icons.mjs` into Shape path data in the 0..1 box with
only M L C Z (arcs become cubics, circles/rects/lines become paths), since the
Shape parser reads no arcs. An icon is a Shape path clip with no fill and one
round-capped stroke, 2/24 of its size, so it restyles like any shape.

Editor: an Icons column in the Add menu with search. Agent: `list_icons`, `add_icon`.
