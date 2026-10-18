# Text edited in place

Before: double-click opened a textarea over the text in UI styling, and a freshly drawn text
focused a textarea in Properties.

Now the drawn element itself becomes editable inside the preview iframe (`text-edit.ts`, a
self-contained script composed into every frame like `measure.ts`). Same element means same
font, size, weight, tracking, leading, colour, alignment, wrap width, rotation and position;
IME and selection are the browser's own. The script reports each keystroke and the final text,
tagged with an edit id so a newer edit is never ended by an older one; it ends on Esc, Enter
(⇧Enter breaks the line), blur, or when the element is redrawn away. The host writes the text
once through `writePartText` → `edit()` (history, save queue), so ⌘Z undoes it.

- On the GPU engine the HTML player is shown and the GPU layer hidden while editing.
- Double-click on a plain text (no parts) from the canvas or frame level edits it at once
  (`drill.ts`); Enter on a selected text edits it.
- Canvas double-clicks reach an editor that is already open through `frameDrill.listen`
  (GPU canvas surface and DOM `MotionNode`); an editor opening right after still takes the ask.
- `SelectionOverlay` listens to `dblclick` directly: Svelte's delegated handler never ran,
  an ancestor stopped the event.
- The textarea path stays only for hosts without a preview.
