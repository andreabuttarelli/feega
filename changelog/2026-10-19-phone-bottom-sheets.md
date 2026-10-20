# Phone bottom sheets: Layers, Properties, Chat, Insert

**Why.** On a phone the layers tree did not exist, Properties got clipped at the bottom, and the
canvas add bar took a whole row.

**What changed.**
- `sheet-detents.ts` gains free height: `settleHeight` snaps within `SNAP_PX` of peek/half/full,
  otherwise keeps the released height; `tapHeight` steps; `readSheetPx`/`writeSheetPx` remember
  the height per sheet in localStorage.
- `PhoneSheet.svelte`: one sheet component (grabber, free drag, scroll body, safe area, z 80,
  portaled to body). Used on the canvas for Chat (`mobile-chat`), Layers (`mobile-layers`) and
  Insert (`insert-sheet`). Chat stays mounted; the right bar still moves into the same `BarSlot`.
- `phone-sheets.svelte.ts`: one sheet at a time across canvas layout, add bar and frame editor.
- `MobileViewSwitch`: + and Layers segments. `CanvasAddBar` hides on phones and renders the
  insert grid (draw tools, generative nodes, upload, templates; frame context: draw, image,
  frame templates).
- Frame editor: Layers tab and sheet (`LayersPanel` with `Density.Touch`, 44 px rows, up/down
  on the picked layer since HTML drag does not fire on touch), + tab, sticky Properties head,
  sheets above the timeline and bars.

**Discarded.** Pointer-driven drag reorder on touch: up/down buttons cover reorder with far less
code. Search in the insert sheet: the desktop bar has none.

**Known, not from this change.** `phone-side-sheet`, `phone-top-bar` and the frame half of
`phone-bottom-stack` fail on `dev` too (double-tap does not open a frame; step d).
