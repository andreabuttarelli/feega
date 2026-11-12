# Imports: layers named by what they are, a measured layer guard

A Stripe import showed one text under five containers all named `USDB`.
`page-flatten` named every container holding a single text after that
text, and page-tree names the frame that boxes a text for a stack after
the text too.

- Names: a container never takes a text's words. Order: component name,
  tag or ARIA role (new: `role="navigation"` → Nav, `listitem` → Item…),
  id / aria-label unless generated (`__next`, `:r3:`), class word
  (`Card`, `Badge`, `btn` → Button), Icon / Image, Row / Column, Frame.
- Code import: a wrapper with its own `source` is no longer folded,
  grown, hoisted or merged into a layer with another `source`: the
  survivor would own the wrapper's padding or gap and write-back would
  put it on the wrong element. A survivor without a source inherits the
  wrapper's. Pull and write-back key on `source` only (tested in
  `code-doc.test.ts`), never on names.
- Guard: `url-layers.browser.test.ts` plans the same captures, renders
  every slice, breakpoint view and the frame resized to 768/390 with
  images swapped for solid colours, and diffs pixels against a baseline.

Measured on fresh local captures of stripe, vercel, linear, supabase
(default shape, with breakpoints): layer counts unchanged (2768, 432,
2069, 1095), parent/child pairs with the same name 195 → 104, 9 → 0,
82 → 26, 13 → 2. Pixels: 0 differing on every shot; linear's gradient
and one stripe image region flip between runs of the same code (18 652
and 3 px), identical to a baseline rerun.

Tried and left out, each failed the guard: unwrapping a text boxed for a
stack (glyphs move up to 1 px: the engine lays a text flow item out
differently from a text in a frame), dropping an svg's idle clip to let
a narrower wrapper take its frame (stroke edges change), placing an
instance directly where a full-width wrapper held it (4 layers on
stripe, not worth a rule). Not done: instances whose flattened shapes
diverge keep their unflattened layers (33 on stripe, 54 on linear);
breakpoint-only layers (1 132 of 2 838 on stripe) come from views that
do not pair, not from wrappers.
