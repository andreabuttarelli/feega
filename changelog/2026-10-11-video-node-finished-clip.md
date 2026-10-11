# Video node adopts a render the other reconciler finished

Production runs (wan-3.0, seedance-2-fast, flux-video-upscale, 2–11 Oct) expired with
"the request that ran it never came back" although their clip was rendered, stored and
billed. Two reconcilers read the same `video_renders` row: `videos/render/work` finished it
(status `done`, `media_url` set) without touching `node_runs`; `reconcileVideoNodeRuns`
then failed to claim the row (no longer `rendering`), released, and retried until
`expireStuckRuns` closed the run at 20 min.

Now `reconcileVideoNodeRuns` reads the row's terminal state first: `done` deposits
`media_url` on the node, `failed`/`expired` closes the run with the row's error. Run
`cost_usd` stays null there: the other reconciler already billed into `ai_calls`.

Discarded: making `videos/render/work` skip canvas rows — no column marks the owner, and
adopting also rescues rows already finished.
