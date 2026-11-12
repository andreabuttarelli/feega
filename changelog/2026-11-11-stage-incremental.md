# Canvas: a pan restages the frames once per quarter screen, not per tick

After #2006 a camera-only paint in `CoreFrames.svelte` is `setCamera` + `frame`, but the sight
(ids on screen and within one screen) was taken on every tick with two `SpatialIndex` queries,
and with dense cards it changed on most pan ticks because some card crossed the screen edge.
Each change reran `resident`, `chains`, `toBuild`/`toWarm`, the thumbnail and card-order effects
and a full `stage` — all O(n), with `fillOrder` sorts the top JS cost of a pan.

The sight is now taken over the screen plus a quarter screen of slack on every side
(`SIGHT_SLACK` in `sight.ts`), and kept while the screen stays inside that reach and the zoom
inside one cache step (`stillHolds`). A tick inside the reach costs one rectangle check. Readers
see a superset of what they saw before: on-screen ids include the slack, near ids reach one
screen plus the slack, thumbnails are asked for the slackened screen.

`stage` put the placeholder of every node on screen through a `SpatialIndex` rebuilt over all
chains at each restage (`standIndex`); it now reads `sight.onScreen`, which already covers what
can come on screen before the next restage.

The bigger cost on the bench was not the sight: during a pan a frame's picture leaves the engine
and comes back near, its bitmap decodes asynchronously (`decodedOf` in `core-web.ts` answers null
until `createImageBitmap` lands), and `sceneBusy` made `paintOn` run the whole `stage` on every
paint to poll that upload — about three stages per wheel tick. During a gesture a busy scene now
only retries the owed uploads (`uploadOwed`, O(pending)); the full `stage` runs when one lands, or
once the gesture is quiet, as before.

Rejected: patching chains and the keep-set per id that entered or left. With the reach, the full
restage runs once per quarter screen of movement; per-id bookkeeping would add a second source of
truth for what is put and pictured.
