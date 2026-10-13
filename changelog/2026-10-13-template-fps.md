# Templates keep their timing across frame rates

**Before.** `insertTemplate` copied the template's comp (authored at 30 fps) into the target doc
frame for frame. In a 60 fps doc a 14 s template lasted 7 s and the precomp went black after
half. `setFrameRate` had the same hole: it converted top-level tracks and camera but not
`comps`, so a doc switched to 60 fps froze its precomps halfway.

**Fix.** `setFrameRate` now converts everything frame-valued: tracks, comps (duration and
tracks), clip junctions, path tangents, clip and doc markers, work area, light keyframes.
`insertTemplate` runs the template source through it at the target doc's fps — one place, so
every path is covered: editor library insert, chat `add_template`, start from template /
`composedTemplate` (canvas Composition node), template API.

Custom components read `fps` and `duration` in seconds from the doc, so they follow without
changes.

**Discarded.** A per-comp `fps` with time mapping inside the Precomp renderer: every reader of
comp frames (fit-duration, style, direction, render cost) would have needed it.
