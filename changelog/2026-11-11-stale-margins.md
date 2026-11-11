# Canvas: no stale picture at the edges after a zoom

After a zoom with tiles on, the exact picture built at rest is adopted into the retained screen
texture, but only its screen area is copied: the overscan margins kept pixels from an older camera.
The retained screen then presented those margins on the next small pan, so frames that had left
the view showed up frozen at their old position. An adopted picture now marks its margins stale and
the first camera move rasters them.
