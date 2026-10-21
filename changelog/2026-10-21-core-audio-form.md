# Core audio card: the controls

The default canvas shows `AudioControls` (operation, model, voice with preview and "More voices", stability/similarity/style sliders, language, seconds) in the references slot of an audio tile. The core gen card drew "Add references" there. `audioFormOf` (`audio-form.ts`) lists the fields from the node's params and `genTileView` carries them as `form`; `gen-card.ts` draws them in the same two-column grid (11px, 7/9 padding, selects 24.5px tall, sliders with accent fill).

model3d needed nothing: "Choose a model" is the warning of its run quote and core already draws it once the model catalogue has loaded (the earlier mismatch was a screenshot taken before that).

Not drawn: the number of voice slots left on "More voices", the live voice list (the voice shows by its saved name).
