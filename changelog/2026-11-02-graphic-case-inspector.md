# Graphic case study fixes: export, rulers, frame size, inspector details

From the graphic case study (2026-11-02, `~/Documents/feega-videos/audit/case-graphic/`). Verified
in the browser on a scratch page of project f077fd4e; shots in `audit/fixes/ui-*.png`.

- **M9, Export not discoverable.** `ExportSection.svelte` was a lone `+` that opened the dialog.
  It is now the Figma section: rows of scale × format (`nextExportRow` adds 1x, 2x… with `@2x`
  suffixes), **Export <name>** downloads through the same `exportSelection` action. It closes the
  frame panel (no selection) and the layer panel; `frameProperties.exportRows` picks frame or
  layers (`onExportElementRows` added to `GpuFlow`). `Command.Export` ("Export…") is in the
  command palette and runs the right-click export. The dialog stays.
- **M10, view zooms out by itself.** A drawn shape asked for `FocusMode.Select`, whose fallback is
  the open-time fit capped at 100%: zoomed in, drawing (or the focus after a delete's redraw)
  jumped the view out and the next shape landed off the frame. Drawn shapes now use
  `FocusMode.Drawn` (select + slide, never a zoom change); the late-frame fallback honours the
  placement. The delete-only path did not reproduce.
- **M15.** `⇧R` toggles rulers in Design (it armed the rectangle, which `R` already does); Motion
  keeps `⇧R` rectangle and `⌥⇧R` rulers. `viewFor` now reads the mode. Layout grid / pixel grid /
  outline toggles persist in `feega.frameViews` like rulers did. The Guides tab worked once
  clicked on the tab itself; nothing to fix.
- **M16, headless crash.** Not reproduced: ⇧R + Guides tab and Add fill on a closed path, same
  WebGPU flags, page alive, no errors (only svelte `derived_inert` warnings).
- **M17.** W/H in the frame panel changed the picture only; `tileForDoc` now scales the tile by
  the same ratio (a 1:1 drawn frame stays 1:1). Pages `+`: the page was created but appended past
  the four visible rows; the current row now scrolls into view.
- **Minor.** Side popovers mount on `body` (the right panel's stacking context put them under the
  bottom toolbar). Font list scrolls into view; Rename/Delete no longer truncated. The typing box
  re-measures on `document.fonts` `loadingdone`. Transform offsets were rounded to 3 decimals
  before scaling (260 px → 261): `shownNumber` rounds after. Layout grid fields are labelled.
  Multi-select X/Y/W/H show the union bounds; X/Y move the selection, W/H stretch it
  (`selectionPlan` in `layer-box.ts`) — discarded: uniform `placeBox` scaling, not Figma-like.
