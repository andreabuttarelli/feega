# Scale tool (K)

The stage handles already scale through `transform.scaleX/Y`, which leaves the
properties untouched: a text scaled ×2 still reads its old size in the
inspector. K in Design mode (Motion keeps K = pause) turns on the Scale tool:
corner drags go uniform, and on release `bakeScale` turns the drag into
property values instead — box, text `size` and stroke weights (`SCALED` in
`scale-tool.ts`, one row per scaled property), positions pushed out from the
anchor — and the transform scale stays as it was. K again, or V, goes back.

Agent: `arrange_space` op `scale` with `factor`, from the top-left of the joint
box. No new tool name. A result outside a property's range is refused, not
clamped.
