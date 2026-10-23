# Style library: edit text styles, rename across frames

The canvas Styles section only recoloured a style. Text styles (font, size, weight, tracking,
leading) could be defined from MCP or a frame, never edited from the library, and a name could
not change without detaching every element.

- `renameStyle` (`styles.ts`) moves the definition under the new name and relinks every element
  (`styleRef`) of the frame; refuses a missing style, a taken name, an invalid name.
- `StyleLibrary` (`style-library.svelte.ts`) takes a sink with `push` and `rename`; `GpuFlow`
  commits each to every frame that has the style (one history entry per frame).
- `StyleLibrarySection`: name is an input, text styles show font, size, weight, tracking and
  leading; values are validated by `styleSchema` before they leave the panel.
- MCP: `named_style` action `rename` (one frame) and `canvas_style`/`styles` with `to` (every
  frame on the canvas; refused when another frame already uses the new name).
