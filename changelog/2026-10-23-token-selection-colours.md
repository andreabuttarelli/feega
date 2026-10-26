# Brand tokens in selection colours

`selectionColours` only saw hex values, so a layer bound to `brand.text` had no
row and could not be recoloured with the rest. Tokens (`BRAND_COLORS`) are now
entries beside the hex ones. A token row offers the other tokens (a select, not
a colour input), so swapping stays a token binding instead of flattening to a
hex that no longer follows the brand. `recolour` is unchanged: it already
swaps any matching value, and a hex swap leaves tokens alone (tested).

Not done: a token row does not show the brand's resolved colour; the inspector
has no brand tokens in scope.
