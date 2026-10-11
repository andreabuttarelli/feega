# Tour on mobile

**Why.** On a 390px phone the tour scaled the 960×600 desktop scenes down and cropped the sides:
cut text, a thin band of content between empty dots, UI text at 8–10px.

**What.**

- `stageLayout(width)` picks a portrait composition at ≤640px stage width. `TourStage` holds
  one table, layout × scene → component; portrait scenes live in `scenes/portrait/`.
- The portrait world is 360px wide and as tall as the box (`portraitWorld`): scale ≥1 at
  360–640px, so text drawn at 12px is never smaller on screen.
- Compositions: make (brief → steps → film), phone editor (preview, timeline strip, chat),
  canvas grid (inputs above, video, sources below), vertical connect graph (`NodeFlow.Down`
  on `TourNode`), export sheet then phone browser with the embed, mobile dashboard hero.
- Loops: every looping scene and `TourFilm` fade at the seam (`tour-seam`) instead of jumping
  back. `TourStage` restarts all animations of a scene on one start time, so the three films on
  the last slide play in sync.

**Discarded.** Scaling the desktop scene to height: text drops under 8px.
