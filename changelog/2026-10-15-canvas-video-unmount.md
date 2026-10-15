# Far and zoomed-out video nodes unmount their `<video>`

After #600 video nodes were drawn by the poster layer, but every node still kept a hidden
`<video preload="metadata">` in the DOM. In WebKit a drag over a 200-video canvas fell to 2 fps and
the page closed.

`LiveVideo.svelte` replaces the raw `<video>` in generated (`+page.svelte`) and uploaded
(`UploadedNode.svelte`) video nodes. The rule is one table, `videoMounted` in `live-video.ts`:
mounted when selected or playing; otherwise only on screen at a readable zoom. The on-screen set and
the view (overview/readable) come from the settled plan in `CanvasImageTiers` (`TierBoard.see`), so
nothing swaps mid-gesture. A remount resumes at the last `currentTime`.

Uploaded video/image nodes also get a poster now: `tilePoster` reads `refId ?? assetId` (#600 only
read `refId`).

`canvas-frame-budget.spec.ts` now gates drag average fps too; drag p5 stays reported only (30–60
frames per sample, too noisy to gate).
