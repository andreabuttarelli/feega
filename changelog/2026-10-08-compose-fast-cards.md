# /app/compose: posters instead of live players

**Cause.** Every visible template card mounted a full `CompositionPlayer` (composeHtml + iframe,
3D render loop): 8 live iframes at 1440. Recent compositions read the doc head one query per node
(up to 24, full doc jsonb each).

**Now.** Templates show a static poster (`static/compose-templates/<layout>.jpg`, 270x480) and play
a 4.5 s mp4 (~13 KB) on hover, or in view on touch, one at a time (`preview-play.ts`). Assets were
captured from the old live preview with Playwright + ffmpeg. Recent cards use node
`posterAssetId` / `lastRenderAssetId`, signed in one `signedAssets` call; heads come from one
`readHeads` query keyed on `docHeadRevision`. Project sample pictures in template previews dropped.

**Measured** (dev server, fixture session, 4 compositions, cache off): requests 638 -> 408,
transfer 33 MB -> 10.5 MB, iframes 8 -> 0, TTFB ~0.5 s -> ~0.35 s.

**Open.** Nothing writes `posterAssetId` yet: recent cards without one show "No preview yet" and
play the last render on hover if it exists.
