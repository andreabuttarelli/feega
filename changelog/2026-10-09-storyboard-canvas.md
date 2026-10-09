# Storyboard canvas for a motion video

The script was a text brief: acts, flow and emotion were read line by line. Now the motion agent
also lays the film out on a normal canvas linked to the video — no new node type, no new viewer.

- `write_storyboard` → `planStoryboard` (`motion/storyboard.ts`, pure): act heading cards, one `doc`
  card per beat (act, kind, intent, on screen, emotion + intensity, duration, visual, music),
  columns left→right; y = intensity, so cards and their flow edges draw the emotion curve.
  `branch_of` puts an alternative under the beat it replaces, wired from the same predecessor.
  Beat media (project image/video asset ids) become `image`/`video` nodes wired to the card.
- `storyboardStore` (`server/motion/storyboard.ts`) writes through `writePlan` and the canvas
  repos. Lazy: the first write creates the canvas; the link is `storyboard: { canvasId, placed }`
  on the motion node's `data`. A rewrite soft-deletes only `placed`: what the user added stays.
- `read_storyboard` returns cards left→right (doc `content`, text `prompt`), media with asset ids
  and the card each feeds, card→card flow. `update_storyboard_card` patches one card.
- Prompt: storyboard just before `write_script` (the brief ends the turn); on go, read it and
  follow the user's version.
- No migration: the canvas→video back-link from the design would need a column on `canvases`;
  the motion node's data is enough to find the board.
