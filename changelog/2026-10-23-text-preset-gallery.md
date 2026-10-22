# Text animation preset gallery

Jitter-parity TX-20. Three presets sat in a select box (`blur-up`, `word-stagger`,
`line-mask-up`), named after the engine, with no preview.

- Ten more presets in `PRESETS` (`text-animators/ops.ts`): fade chars/words/lines, slide
  words/lines, scale chars, blur words, drop chars, spin chars, typewriter. Same mechanism as
  before (one animator plus a keyframed offset), so MCP `apply_text_preset` lists them without
  a code change and the animator can be tuned afterwards.
- `TextPresetGallery.svelte` replaces the select in Animation: a tile per preset, hover plays a
  small sample. The sample is derived from the animator values (`preset-preview.ts`), not a
  second hand-written table. Starts at the playhead; the length field sets the duration.
- `sweepOf` keeps a minimum margin so a hard-edged preset (typewriter, softness 0) starts fully
  hidden.

Not done: an out-animation variant, and applying from the timeline context menu.
