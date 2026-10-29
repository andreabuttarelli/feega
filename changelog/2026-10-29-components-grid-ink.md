# Components grid: ink crop and tile tone

Follows PR #1576.

- Light content vanished on the light tile. `toneOf` averages the preview's alpha-weighted
  luminance; light ink gets a dark tile, dark ink a light one. Picked over the nearest ancestor
  background: the main often has none, and pixels are already in hand.
- Text-only components were cropped to the text box, so words looked tiny. A 2x probe of the
  coarse crop is read back and `inkBounds` finds the painted pixels; the final crop is that
  plus 8% padding. One extra small readback per preview.
