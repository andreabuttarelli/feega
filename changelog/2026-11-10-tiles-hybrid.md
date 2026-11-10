# Tiled canvas: exact picture when still, tiles when moving

Tiles made gestures smooth but slowed load: frames stayed empty until the whole screen was sharp
(#1898 turned them off). The hybrid (`?coreTiles=1`) keeps the exact retained path for still views
and draws from tiles during gestures, lifts and the settle after them; the exact picture built
after a gesture is adopted into the retained texture. Tiles warm up only after a second without
uploads.

Defect found on the way: tile warm-up consumed the exact path's damage, so edits arriving while
tiles warmed never reached the screen (frames blank after their vectors were drawn, and runs that
never settled). The load bench now checks that drawn content is on screen within a frame.

Discarded: requiring tiles to cover the screen before a lift uses them — tiles are rarely warm when
a drag starts, so every element drag went back to the exact path.

Numbers in ADR 0034 (status 2026-11-10). Still behind the flag: drag-element and 4x first content
are not yet at the target.
