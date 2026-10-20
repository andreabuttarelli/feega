# Core canvas: what was drawn stays drawn until its replacement is in the raster

#1022 drew a placeholder for a node whose new layer was "ready" as data but not yet uploaded:
the remembered previous picture was dropped the moment the new list existed (`lastShown`), and
puts pause mid-gesture, so a zoom produced black boxes.

Now `drawnLast` records what `paint` actually drew per node (a real layer, never a placeholder or
blocks), and the chain is `[new, drawnLast, blocks, placeholder]`: `firstDrawn` keeps the old one
until the new one is pictured. It is held while a node rebuilds and for 15 s after it was last on
screen (desktop only; phones keep 0, their texture budget is the constraint). The DOM handover set
(`onready`) follows the same rule so a node's chrome does not toggle either.

Measured on b5a892f3 from load (pan, zoom, large zoom steps): nodes drawn then shown as
placeholder/blocks/nothing while on screen, 0 (18 before in the large-step zoom).
`lastShown` and its tests are gone: the rule moved from data readiness to what is in the raster.
