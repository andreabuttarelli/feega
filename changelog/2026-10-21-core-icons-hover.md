# Core: solid icons, no DOM card on hover

Icons drawn from stroked outlines (`iconContours`) looked dotted at high zoom: the pieces of one stroke (bands, joins, caps) wound in opposite directions, so where they overlapped the non-zero fill cancelled. Every piece is now turned the same way before it is handed to the painter.

In `?renderer=core`, hovering a card used to mount its DOM component over the vector card after 150 ms. Hover no longer mounts it; selection and focus still do.
