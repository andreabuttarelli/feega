# Landings benchmark measured placeholders

The first landings numbers (#1846) were taken too early: the start screenshot showed white
placeholders, and the "zoomed" shot was an empty stretch of canvas. The canvas itself rendered the
pages; the benchmark did not wait for them.

Now each run waits until every on-screen frame is drawn by the core and its interior has ink
(pixel spread, not a flat white rect), every gesture starts from the same camera (fit, then two
zoom steps), drag grabs a frame actually on screen, and the zoomed shot is zoom-to-selection on a
frame. The server works on a copy of the fixture: a drag used to save into it, moving frames for
every later run. Screenshots: start, fit, zoomed.

The "0-byte pixel diff" in #1846 compared two placeholder screens and proves nothing.
