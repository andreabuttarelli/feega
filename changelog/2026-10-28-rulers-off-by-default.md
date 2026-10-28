# Rulers off by default, tidier

Rulers on an open frame crowded the selection handles and clipped the
last label. They are now off by default and toggled with `Alt+Shift+R`
(already in the registry) or **Rulers** in the burger menu; the
choice persists per viewer in localStorage (`feega.rulers`).

`Shift+R` was not taken for rulers: it is the Rectangle tool.

Strips now sit inside the frame edge, stop short of the corner handle,
and `rulerTicks` drops a tick whose label would run past the end.
