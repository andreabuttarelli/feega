# Timeline reaches the left edge with no panel open

The timeline's left offset was always rail width (68px), leaving an empty strip when Layers,
Assets and the other left panels were closed.

`shellLeftOf` (`src/lib/shell-insets.ts`) is now the single place that computes it: the floating
gap (12px) when closed, rail + panel + gap when open. The existing `left` transition animates both.

The rail is vertically centred and the timeline sits at the bottom, so they share the left strip.
Discarded: keeping the offset past the rail at the bottom; it left the strip empty.
