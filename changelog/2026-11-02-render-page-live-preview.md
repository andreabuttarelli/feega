# The render page shows the frames it renders, in a redesigned card

The in-browser render page (`/render/[token]`) kept its preview black for the whole render:
`MotionPreview` captures off-screen, so nothing reached the visible stage. `tapFrames`
(`src/lib/motion/export/preview-tap.ts`) wraps the frame source and draws a frame on a
canvas over the stage before the encoder gets it, at most every 250 ms, so the preview
costs no encode time. When done, the stage plays the finished MP4.

Layout rebuilt on DESIGN.md tokens: centred card on `--ui-canvas`, lowercase mega title,
preview in the frame's aspect ratio with `md` radius, large percentage + bar, time left,
frame count secondary, segmented resolution picker, `sm` buttons (secondary Cancel,
Download + Open when done). Works at 400px.

Discarded: polling `preview` for a screenshot (a second capture per frame).
