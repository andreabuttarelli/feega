# Core canvas never shows holes while it loads

On `?renderer=core` without Pixi underneath, a node the core had not loaded yet was simply
missing. Every node now gets a core stand-in at once: a card its empty panel, a frame its black
stage (`placeholders.ts`, one shared group per kind and size). The best ready layer replaces it
in the same paint — whole group, then poster, then stand-in — so nothing flickers. Frame docs
load visible-first, nearest the view centre, at most 3 at a time on a phone and 6 on desktop.

Residency now counts the bytes of a frame's pictures, not its whole doc area once per picture:
the landings (2 images on a 1440×5000 doc) were being evicted as 57 MB each and fell back to
stand-ins forever. A card whose picture fails (404 on the copy) still shows, without the picture,
as today.

Bench (`scripts/bench/canvas-core.ts`, heavy copy): stand-ins on screen 0.3–0.8 s after start,
view fully covered by real content in 0.8–1.5 s on the iPhone profile, 1.5–1.9 s on Chrome.
