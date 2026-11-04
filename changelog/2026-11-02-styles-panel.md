# Styles panel as compact rows

`StyleLibrarySection` rendered every style as an always-open form: size as a frame
fraction, a black chip on every text style, a name typed before creating. Now:
Text / Colour / Effect groups (`GROUPS` table), one row per style ("Aa" in the
real font + `textMeta`), editor in the existing popover, delete behind a ⋯ menu,
"+" creates "Text style N"/"Colour N" and opens it.

Size is shown in px of the frame's short side (`type-px.ts`, tested); the
stored value stays a fraction. Data model and `styleLibrary` API unchanged.
Discarded: inline expandable rows (still a form in the list).
