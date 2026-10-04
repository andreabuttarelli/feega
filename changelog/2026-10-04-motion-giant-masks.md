# Motion: giant masks, trimmed custom clips, reserved param names

Found while building a transitions showcase by hand in the editor.

- **Mask size cap 4 → 60, centre range −1..2 → −30..30.** A text mask that opens onto the next scene has to grow until one letter
  stroke is wider than the frame: a 520 px word needs ~55×. At 4× the word never covered the frame; zooming about a letter stem moves the mask centre far off-frame.
- **`trimStart` honoured by custom components.** The runtime always started a component at its own
  zero, so a scene split in two clips (one masked as text, the next as an iris) restarted its
  animation at the cut. The run now carries `trim`; the component timeline is scrubbed from `trim`
  and keyframed params keep clip-relative times. Untrimmed clips are composed exactly as before.
- **`param('name', …)` refused.** `name` is the clip prop that points at the component: a param with
  that name saved fine and the doc was rejected on reload, so the editor opened empty.

Discarded: letting a custom component act as a track matte. Mattes are built from a clip's props
(text, shape, picture), not from rendered pixels; a pixel matte needs a compositing pass the
HyperFrames runtime does not have. A text mask on the real scene clip covers the type-mask case.
