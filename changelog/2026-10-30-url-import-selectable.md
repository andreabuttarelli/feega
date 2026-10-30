# Imported pages are editable right after they land

Realtime delivered the new frame (revision 1) before the import response (revision 2, images
filled). `landImported` appended the response node next to the realtime tile, so the canvas
held two tiles with one id and the stale one won: no layer inside the page could be selected
or hovered until a reload, and the camera did not frame the page. `landTiles` replaces tiles
with the same id, as the other create paths already did. Guarded by `land-tiles.test.ts`.
