# Still frames show no video controls

Which video control a frame shows is now one table, `CONTROLS` in `src/lib/motion/still.ts`
(`DocMode` → set of `VideoControl`), read through `controlShown`. A still shows none: the
editor drops the transport (play, steps, timecode), the Design/Motion switch, the timeline
and keyboard play. Before, a CSS rule on `data-mode='still'` hid transport and timeline while
the switch and the space key still worked. Canvas tiles already lost playback in #770 for every
frame, so they have no row. The Still checkbox in Composition settings stays the way back to
motion.
