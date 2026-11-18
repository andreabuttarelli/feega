# A page's poster stays until the whole page is ready; pictures go nearest-first

Three defects made pages load in visible steps, with some of those steps looking wrong.

**Poster replaced by an unfinished page.** `postersFor` dropped a frame's poster card as soon as
the frame had any put, and the `:vectors` put counted as one. A complete poster was swapped for
vectors with grey picture blocks, then for the whole page several seconds later. `shownBefore` now
returns `OnScreen.Poster` for a frame that has a poster. `showStaged` skips the vectors stage for
that frame and shows a settled result only when it is `Whole`, or on the last retry, so a broken
picture cannot pin the poster for good. A frame with a poster now changes once: poster → whole
page. Frames without a poster still show vectors first.

**Held poster card squeezed into the frame rect.** A poster card's list covers the frame plus its
chrome reach: 96 world units each side, plus `reachTop`, which grows when zoomed out. While its new
group was not pictured yet, the chains code re-placed the held layer (`before`) at
`bledBox(p.box)`, which is the frame's own box. The whole card list was squeezed into the frame, at
a different scale on each axis (×0.87 in x, ×0.94 in y at zoom 0.05). The page looked narrower,
pushed down and stretched. `heldBox` keeps a held layer at the box it was drawn at, moved with the
frame and never rescaled.

**Pictures one frame at a time, then all at once.** `pictureTurns` (#2325) let one frame fetch
pictures while any on-screen frame lacked a layer. Turns were handed out FIFO, and a frame held its
turn until every one of its pictures had decoded. Frames whose vectors were already drawn waited
behind each other in build order. When the last on-screen frame got its vectors, every waiting
frame started at once: on posters36, ~900 image requests in one second at 10 s, off-screen frames
included, after a 6 s trickle. A frame built just after that queued behind all of them.

Now `sightRank` ranks turns at hand-out time: on-screen frames by distance from the centre first,
then the rest. Local mode (`pictureLimitsFor`) lets 3 frames fetch while on-screen sources are
still owed, and 6 after, so the burst is capped and a newly visible frame goes ahead of off-screen
ones. Hosted stays unbounded. A frame counts as owing its source until it is built
(`owesVectors`), not until its vectors show, because a postered frame now never shows them.
