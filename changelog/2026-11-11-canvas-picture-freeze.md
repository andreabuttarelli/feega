# Live playback shows the newest DOM-read picture

Templates whose picture comes from a DOM read (a `<canvas>` drawn imperatively: Dot bloom, the `rendercomp-pixel-*` ports) froze on the canvas stage while playing; export was correct.

Cause: `CoreFrames` resolved DOM-read pictures from a map of resolvers, first registered wins. The poster build registered one; the live path (`liveOff`) never registered its per-tick read, so every tick drew the poster's canvas. Present before #1953 (checked on its parent): `rebuildLive` dropped `custom.picture` there too.

- `customPictures` (`src/lib/canvas/core/custom-pictures.ts`) resolves newest-first; a playing frame registers its read under `<id>:live` each tick and drops it when playback ends.
- #1953's read-once of still placeholders is untouched.
