# Resize to fit

A frame container could be moved and framed but never shrunk or grown back to its content: the
only way was dragging the edges by eye.

- `resizeToFit` (`layout/ops.ts`): a plain frame takes the bounding box of its children; an auto
  layout is set to hug on both axes, since its size comes from the layout.
- Command `resize-to-fit` (⌥⇧⌘R): Layer menu, selection actions. MCP: tool `resize_to_fit`.
- Children stay where they are; only the container moves. Discarded: padding option, add when asked.
