# An attached image arrives with its measured palette

**Before.** An attached reference reached the model as a picture only. The model guessed its
colours: for a bright magenta fractal with cyan, orange and green bands (versus run1,
`abstract-loop`) it built glowing magenta on a near-black ground.

**Now.** `paletteOf` (`src/lib/server/chat-attachments/palette.ts`) samples the picture
(64 px, nearest), buckets pixels, merges shades of one colour (RGB distance under 80) and
keeps up to six colours over 3% of the picture, by share. `paletteNote` writes them with
their shares and how light the ground is, and `userContent` appends it to every attached
image's label: the motion agent and the canvas chat both get it, at no model cost.

**Not done.** A gate that measures the rendered frames against the reference palette: the
note steers the agent, nothing blocks a cut that ignores it yet.
