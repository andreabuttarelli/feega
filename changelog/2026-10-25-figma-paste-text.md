# Figma frames paste with their text visible

A frame pasted from Figma landed as a video frame (no `still`). The canvas
rests video frames at time 0, and Text fades in over its first 18 frames
(`Motion.FadeUp` in the GPU text painter), so every pasted text was drawn
at opacity 0: shapes showed, words didn't. Free elements were already
stills (`blankElement`).

`frameItem` in src/lib/canvas/figma/figma-doc.ts now builds the frame
with `drawnFrame(..., MotionFormat.Custom, 0)`: a Figma design is a
design, pinned at frame 0, where text skips the entrance.

Found while recording the Figma paste demo. Not changed: video frames
made elsewhere still rest at 0 with their text fading in.
