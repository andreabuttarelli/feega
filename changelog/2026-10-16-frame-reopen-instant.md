# Reopening a frame fetches nothing

**Before.** `earlyFetch.take` drops the session on open, so every reopen fetched `/session` and showed
"Opening the editor…" (15 frames in the new e2e). A prefetch kept up to 15 s could also carry a head
older than the edits just made.

**Now.**
- `InlineMotionEditor` keeps the last session per frame; `frameDocs.saved` records the head the shell
  last synced (`follow`, `adopt`). `reopened()` (`src/lib/canvas/reopen-session.ts`) swaps that head in,
  unless the server revision passed by the page is newer (a peer saved): then it fetches as before.
- `prefetchSession` skips frames with a kept session.

**Not done, on purpose.** Moving the editor stage into the tile DOM (dropping `anchoredTo`). The tile
lives inside the zoomed viewport transform; the editor stage, selection handles and text need
screen-space pixels (the "drawn sharp" phone spec). With the shared doc (#689), the synchronous leave
and this reuse, the overlay no longer causes a visible handover, so the reparenting buys nothing users see.

**Trade-off.** A reused session keeps tokens, assets, runs and templates from its first load; a new
asset added elsewhere shows up on the next fetch (page reload or a peer save).
