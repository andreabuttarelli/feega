# Landing case study minor findings: Esc, Shift+wheel, frame Rename, Pages

From `~/Documents/feega-videos/audit/case-landing/FINDINGS.md` (minor list).

- **Esc puts the tool down.** `frameBar.disarm()` runs before Esc climbs out of a frame or
  deselects: an armed drawing tool goes back to Select and the key is spent, as in Figma.
- **Shift+wheel scrolls sideways.** `wheelPan` (`canvas/gpu/camera.ts`) turns a vertical delta with
  Shift into a horizontal pan; a trackpad that already sends `deltaX` is kept.
- **Frame Rename in the context menu.** A `rename` selection action (one node) opens the same title
  editor as a double-click on the label. Duplicate was already listed.
- **Pages.** Double-click renames any page: a non-current row opens first, then its name turns
  editable once it is current (`renameOnArrival`). The list keeps its own scroll
  (`overscroll-behavior: contain`, thin visible scrollbar). The scroll defect was not reproduced
  in a browser here; the list already had `overflow-y: auto` with a 4-row default height.

Not done: feature video (fixes only).
