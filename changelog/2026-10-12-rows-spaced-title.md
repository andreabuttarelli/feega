# Rows and spaced title template

Built-in `builtin:rows-spaced-title`, from a reference: square photos in a top and a bottom row
scrolling at constant speed in opposite directions, a centre title with wide even word gaps.

- Photos split between rows (even/odd) from 4 up, so each row loops on fewer cards and moves slower.
- Loop shift is a whole multiple of a row's photo count: seam is exact.
- Words use the shared `wordIn`; all fade out together before the seam.
- `tighten` optionally closes the word spacing with expo in-out after the last word lands; default 0 as in the reference.
- Title scales down to 90% of the width when it would overflow (vertical).
