# Layout grid: grid cells snap, clearer section

**Before:** layout guides (#1221) snapped elements to column and row edges, but a `grid` guide
(square cells) drew lines and snapped to nothing, because only bands fed the snap targets. The
inspector section was labelled "Layout guides" with a text "Add" button and no hint.

**Now:** grid lines are snap targets like band edges. Section is "Layout grid" with a "+" whose
tooltip names the kinds, snapping and ⇧G. Panel strings say "grid". Real-stack e2e extended to add
a grid from "+" and switch it to `grid`.

**Not done:** Ctrl+G binding (⌘G is group); overlay stays an SVG over the frame, not drawn by the
GPU core. Not exported: the renderer never reads `layoutGuides`.
