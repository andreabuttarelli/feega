# Imports with breakpoints: one layer per element across views

On stripe.com 1 132 of 2 838 layers existed only in the tablet or phone view:
the narrow read did not pair with the desktop one, so the panel showed what
looked like hidden duplicates. Measured on the captures of #2095
(`~/Documents/feega-videos/import-fewer-layers/pairing/`), by cause:

| page | view-only before | no DOM key | not in desktop read | other | after |
|---|---|---|---|---|---|
| stripe | 1 132 | 825 | 191 | 116 | 598 |
| vercel | 72 | 50 | 14 | 8 | 37 |
| linear | 395 | 262 | 77 | 56 | 213 |
| supabase | 342 | 272 | 21 | 49 | 161 |

- Layers without a DOM key (svg paths, border strips, stack boxes) now pair
  by position under their nearest keyed ancestor. Rules in one table
  (`PAIRS`, `page-views.ts`): same look outside layout keys, since
  breakpoint overrides carry layout only; same size for rounded boxes, since
  token binding stores their corners as a share of the box. The frame
  surface never pairs.
On the very reads of a live stripe import in the app (local mode), planned
with the old and the new code: 966 view-only layers -> 513 (2 725 -> 2 272
layers). Separate live imports of stripe vary far more by load than by code
(old code: 898 and 1 400; new: 513 to 1 090), since the phone read shows
another tab panel or variant from one load to the next.

- Colour merging and token sampling count only desktop layers, so pairing
  more layers does not move colours. This alone changed stripe: #122054,
  the navy the page paints, now wins over #101d51, which won by view-copy
  votes.
- Guard (`url-layers.browser.test.ts`): 0 differing pixels on every shot of
  stripe, vercel, linear, supabase against a baseline of the colour change;
  live SSIM unchanged.

- Layers panel: a layer hidden on desktop and shown by a breakpoint
  carries a tag with the breakpoint names (`shownOnlyIn` in the
  breakpoint model, `LayerRow.only`). Before, it read as a hidden
  duplicate of the desktop layer next to it.
- Keyless boxes are named after the first keyed element they wrap, not
  their rank: on a live stripe import the phone page stacked two panels
  in the other order and every text inside came in twice.

Tried and left out: carrying the view's whole look onto a paired layer
(overrides cannot hold colours or strokes, the desktop look showed instead),
pairing rounded boxes of another size (tile corners moved a pixel), keeping
position identity out of auto layout boxes (no pixel effect, 200 fewer pairs
on stripe). Not done: reading the narrow widths from the same page load. 191
stripe layers come from a rotating demo and a carousel that show another
panel in each read; resizing a frozen page would not rerun the scripts that
lay it out.
