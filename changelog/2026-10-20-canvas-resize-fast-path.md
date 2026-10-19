# Resize fast path on the core canvas

Resizing a landing-sized frame on the heavy canvas ran at 44 fps with 267 ms frames (Chrome)
and ~1 fps on WebKit iPhone. Causes, in order of cost:

- every pointer move rebuilt every card (`cardOnCanvas`, fontkit shaping): cards now reuse
  their list until `cardKey` changes (`cardsOnCanvas`);
- the frame's texture went stale at each step and re-rastered, or, past the cache side or the
  texture budget, the frame was drawn item by item every frame. The node under a resize is
  now cached and *held* (`UseItem.hold` in gpu-core): the core stretches the texture it has,
  or rasters once at the largest scale within the cache side; it re-rasters at the real scale
  when the resize ends;
- the Custom DOM reader started a hyperframe mid-drag: it waits for the canvas to be still.

Tried and dropped: drawing the edited frame uncached (expanded) each step; worse on a landing.
Left: the selected frame's live DOM preview re-composes on size change (MotionPreview), same
path as the gpu renderer. Bench: `scripts/bench/canvas-resize.ts`.
