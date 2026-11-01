# URL import: blocks holding text are never pictures

Importing supabase.com brought the whole nav in as one image. The walker snapshots a block whose
effect a frame cannot hold (a filter other than blur, a mask other than one linear gradient, a
clip path, a blend with children, a rotation), and took the block's text, links and buttons with
it. The supabase nav was not even rotated: Tailwind's `transform` utility computes to a
`matrix3d(...)` with only a `translateZ`, which `matrixOf` did not parse and `turned` read as a
rotation.

## What changed

- `matrixOf` reads `matrix3d` without rotation or perspective as its 2D part.
- A block that holds text, links, buttons or fields (`holdsContent`) is always walked as layers.
  The effect goes where it can: `drop-shadow()` filters become DROP_SHADOW effects, a blend mode
  goes to every leaf, several linear-gradient mask layers become one gradient "veil" each in the
  backdrop colour laid over the content (stacked veils multiply like `mask-composite: intersect`),
  and other masks, filters and clip paths become a snapshot of the block's own paint (`own` mode)
  as its background. Leaf decorative elements are still snapshots.
- A word split into one inline-block span per letter (Framer's text animations: feega.app's nav
  "Documentation" was 13 text layers) comes in as one text, spaces kept from the gaps.
- supabase.com joins the fidelity pages, and every capture now checks that the nav links and
  buttons a visitor sees at the top of the page are text in the tree (`url-capture`).

Snapshots holding text, links or controls, per fixture (before → after): vercel 1 → 0, linear
4 → 0, stripe 2 → 0, apple 1 → 0, framer 2 → 0, webflow 9 → 0, tailwind 0 → 0, blog 0 → 0,
feega 10 → 0, supabase 2 → 0.

Fidelity (fold/full, fresh capture, before → after): vercel .996/.972 → .996/.970, linear
.986/.978 → .986/.973, stripe .989/.980 → .974/.979, apple .991/.974 → .991/.974, framer
.986/.963 → .987/.969, webflow .989/.964 → .989/.964, tailwind .951/.953 → .951/.953, blog
.974/.965 → .974/.965, feega .957/.961 → .957/.962, supabase .933/.948 → .932/.938. Stripe's hero
heading blends hard-light; as editable text inside an isolated parent it blends with less of the
page than the browser did. Dropping the veils (only ignoring the masks) took linear's full page to
0.942, so the veils stay.
