# Tiled canvas: a changed tile stays on screen until its replacement lands

User report on a real canvas with `?coreTiles`: areas went empty, then content came back.
Any damage (a patched use, a frame rebuilt, an image tier swapped, `Damage::All`) dropped the
touched tiles and their textures at once, so the area showed paper until the re-raster. Now
`Tiles::invalidate`/`clear` mark tiles stale: still drawn, listed as missing, replaced in place
when re-rastered. Eviction still frees textures.

The landings bench gained a settle watch: for 2 s after pan, zoom and fit it samples every
150 ms and fails if any frame on screen is blank. Before: blank after zoom; after: 3 green runs.
Not covered: a frame rebuild driven from outside the bench.
