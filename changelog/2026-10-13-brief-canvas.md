# The brief's size and length land on the video

**Before.** A new video starts 1080x1920, 15 s. The first turn on a blank video goes to the
director, whose tools are research and script only: no `set_canvas`. A brief saying "square
1080x1080, about 10 seconds" stayed vertical and 15 s (versus run1, `quote`); the director
could only tell the user to change it.

**Fix.** `sizedToBrief` (`src/lib/motion/brief-canvas.ts`) reads the format and seconds a
brief names (one table of cues: pixel sizes, ratios, words) and the turn opens on a doc
already sized, recorded as an edit so it is saved even when the turn only writes a script.
Only a video with no clips is sized: a later message on a built video is an edit, handled by
the agent with `set_canvas`.

**Discarded.** Giving the director `set_canvas`: it spends a model step on a fact the brief
already states, and a director that forgets leaves the same defect.
