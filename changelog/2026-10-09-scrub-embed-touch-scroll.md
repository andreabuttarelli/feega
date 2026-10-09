# Scroll-scrub embeds scroll the host page on touch

**Before.** The interactive player page set `#pad{touch-action:none}` for every playback
mode. In `scrub` mode the host page's scroll drives the playhead, but a vertical swipe that
started on the iframe was swallowed by the pad: on a phone an embed filling the viewport
could not be scrolled past, so the timeline could not be scrubbed by touch at all.

**Now.** `playerPage` picks the pad's `touch-action` from one table per `PlayMode`:
`pan-y` for scrub (vertical swipes scroll the host, which posts its scroll back), `none`
for the rest, which still need every touch for pointer and tilt input.

**Discarded.** A transparent overlay in the host snippet: it would also block pointer
input the composition reads.
