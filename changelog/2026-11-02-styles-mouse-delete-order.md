# Styles: delete by mouse, rename right after +, stable order, one colour picker

From the mobile and landing case studies (2026-11-02).

- **M13 / landing #6, Delete style did nothing with the mouse.** The item sat in a dropdown inside
  the style popover; pressing it was a click outside the popover, which closed and unmounted the
  menu before `onSelect` fired. The editor body moved to `StyleEditor.svelte` and Delete is a
  direct button (`style-library-remove-<name>`), no menu.
- **M14 / landing #5, rename right after + left a duplicate.** `StyleLibrary` sent Save and Rename
  as parallel requests; the server could run Rename before Save existed (409), the client undid
  the rename, and the next edit saved under the new name: two styles. Library requests now go
  through one queue (`StyleLibrary.send`), in the order they were made.
- **M15, order changed after reload.** `listEntries` returned rows in physical order, and an edit
  moves a row. It now sorts by `created_at`, then name; a rename keeps the style in place on the
  client too.
- **M15, picker.** `ColorPicker` lists the canvas colour styles first (row "Styles", by name);
  picking one applies its colour (copied, not linked). The stroke editor now shows the same inline
  picker as the fill editor instead of a chip + nested popover (`ColorField`).
- **M15, empty Font row.** A text style without a font shows `sans`, the font it draws with.

Not done: linking a fill to a colour style (picking copies the value).

Guards: `style-library.svelte.test.ts` (queue, rename keeps place), `project-library.test.ts`
(order), `style-editor-render.test.ts`, `color-picker.test.ts`, `stroke-stack.test.ts`.
