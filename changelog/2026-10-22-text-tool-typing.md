# Text made with the text tool is pickable inside a frame

On the GPU canvas a text clicked into a frame could not be hovered or
double-clicked, so typing never started (`canvas-frame-text-typing.spec.ts` red).

Cause: the picker compiles the frame's HTML into a scene. Auto-width and
auto-height texts had no `data-fit`, so `textParts` fell back to an `Html` layer,
which `pickAt` skips. With a text paint, their box sizes (`max-content`/`auto`)
still parsed to 0, giving a zero rect, and `startTyping` refused it.

Fix: the Text block carries `data-text` when it is not fitted, and the scene reads
it as text; `placed` writes the placed size as `data-placed-width/height`, used
when the style size is not a length. Discarded: picking `Html` layers (their quad
is the whole frame).
