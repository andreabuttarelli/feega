# Text resizing: auto width, auto height, fixed size

`sizing` on Text grows from fixed/auto to three values (`TextSizing`): `auto` (auto width, no
wrap, box hugs the line), `auto-height` (fixed width, height hugs the wrapped lines), `fixed`
(box as set; existing shrink-to-fit kept; new `truncate` clips it). Rendered as CSS on the text's
own box (`width:max-content` / `height:auto`), so the preview is the measurement: the editor
reads the measured box and writes it back (`fitTexts`, amended into the last history step), and
a free text asks its canvas node to take that size (`freeTextFit` → `onhostfit` → `resize`), with
`keepTextSize` keeping the letters' canvas size when the box's short side changes.

- Click-created text starts as auto width, drag-created as auto height (`drawClip`, wire
  `sizing`).
- Resizing by hand: a new height → fixed; only a new width on auto width → auto height
  (`sizingAfterResize`, in the frame overlay and on the canvas host).
- A free element resizes freely (width and height apart), not by its aspect.
- Measurements wait for the preview to load the current drawing (stale boxes looped).
- Properties: a three-icon "Resizing" control and "Truncate text"; agents set it with `set_props`.
