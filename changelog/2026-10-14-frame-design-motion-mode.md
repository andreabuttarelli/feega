# Design and Motion modes for an open frame

Before, every edit to a prop that had keyframes added a keyframe at the playhead: there was no
way to move a whole animation, or to lay out a frame without the timeline in the way. Rive
splits this into Design and Animate; a frame now has **Design** and **Motion**.

- **Motion** (the default, the old behaviour): timeline shown, an animated prop gets a keyframe
  at the playhead (`editAt`).
- **Design**: timeline hidden, edits write the base. On an animated prop there is no single
  base, so Design moves every keyframe by the change (numbers) or sets every keyframe (colours,
  strings): the motion keeps its shape. Properties says so in a warning naming the animated
  props.

The rule is one table in `edit-mode.ts` (`EDIT[mode]`), used by `MotionInspector.animate`.
Toggle in the top bar or E; remembered per browser (`feega.frame-edit-mode`). The timeline
hides and shows on the new `--ease-expo-out` (320 ms), which ⌘J now uses too.

Not done: plain V/T/R/O/P tool keys and arrow-key nudging in Design (arrows still step frames);
the timeline's own value editing stays Motion, since it is hidden in Design. No e2e: seeded
e2e on production is stopped and there is no other database.
