# Generate cards drawn as vectors in core mode

**Before.** On `?renderer=core` a generate node showed either a generic
sketch (gray panel, "Auto" pill) or a DOM snapshot from #986. Snapshots
were stale, missing until shot, and theme-blind: a light snapshot showed
on a dark canvas.

**Now.** `gen-tile-view.ts` is the one view model of a generate tile
(state, body rule, hint, placeholder, run/loop buttons with credits,
warning, run history, text output). `GenNode.svelte` reads its labels
from it; the canvas page builds it per node (`genViewFor`) with the same
quote inputs the DOM tile uses, and `core/gen-card.ts` draws it as
vectors with the measured DOM layout (body, references band, footer,
prompt box, right-aligned buttons, AI-generated mark, Markdown/Raw
toggle). A generate card with a view ignores its snapshot.

Disabled buttons are pre-mixed against the paper instead of drawn with
per-item alpha: CSS opacity fades the composite, per-item alpha faded
the text twice.

`shapes.roundRect` took a pixel radius but passed it on as a share of
the side: fixed, 4px chips were pills.

**Parity** (SSIM, 8px windows, 2x DPR, canvas 97faba94): generate cards
0.90–0.95 in light and dark; DOM snapshots of other kinds score
0.95–0.99 in light and ~0 in dark. Gaps left: audio params panel,
reference thumbnails, running conic border, 500/650 weights drawn at 600.

Harness: `~/Documents/feega-videos/core-cards-ui/parity.mjs`.
