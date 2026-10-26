# Timeline opens in Design

#1232. The Design/Animate switch opened in Animate, so a first edit on an animated frame wrote
keyframes the user did not ask for.

- Default is Design (`readMode`, `FrameEditSession`, GpuFlow nudge fallback). A mode the user
  picked before is still remembered and wins.
- E2E `canvas-animation-authoring` now starts in Design instead of toggling into it.
