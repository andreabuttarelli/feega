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

- **Landing #4, names with "/".** `STYLE_NAME` allows `/`; the panel groups rows by the part before
  the last `/` (`folderOf`, `foldered`) and shows the leaf name.
- **Landing #7, Google-font text style refused** ("call register_font…"). Applying or editing a
  text style now registers its Google font in the frame first (`withFontOf` in `styles.ts`).
- **Landing #9, text + colour style.** Colour and paint styles moved to their own slot,
  `paintStyleRef`; a text keeps a text style, a colour style and an effect style at once. Properties
  shows one dropdown per kind (Text style, Colour style, Effect style). Old docs with a colour style
  in `styleRef` keep working (every slot is still read).
- **Minor, "fills · reset" right after applying a colour style.** The colour patch wrote a fill
  without its defaults, so it never equalled the stored fill; it is parsed through `fillsSchema`.
- **Landing #10, multi-select raw values.** Range fields use `sliderOf` like the single inspector:
  px with whole steps (38.880 → 39).

Not done: linking a fill to a colour style (picking copies the value); a style picker on
multi-select; text style size ×1.33 (landing #8, frame units, another agent's scope); the style
picker's place in Properties; uploaded (non-Google) fonts in styles.

Guards: `style-library.svelte.test.ts` (queue, rename keeps place), `project-library.test.ts`
(order), `style-editor-render.test.ts`, `color-picker.test.ts`, `stroke-stack.test.ts`.
