# Posters come from live tiles, in the background

**Before.** A tile with no poster for its revision claimed the single capture slot and mounted a hidden
capture player, even when the same frame was already playing on screen.

**Now.** A live tile drawn at the server revision, with no poster for it, shoots its poster from its own
player on idle (`posterDue` in `live-tiles.svelte.ts`: never a local doc, an older revision, twice, or a
tile already covered) and uploads it. Posters then serve the far-zoom layer and previews outside the
canvas; near/mid zoom shows them only on tiles over the live cap, and only for the current revision.
The capture slot stays for those over-cap tiles.
