# Photo studio loads and posts over bearer

`/app/studio` joins the dashboard pages (`DashboardPage.Studio`); `/app/studio/[batchId]` gets
`GET|POST /api/v1/studio/[batchId][?action=]` (with the page's `maxDuration`), running its own
load and actions (moved to `$lib/server/studio/batch-page.ts`). Batch forms submit through
`apiEnhance`, the drain loop and the studio wizard through `postPageAction`.

The batch `+page.ts` declares `studio:batch:<id>` itself: `depends` inside a load served over
bearer is a no-op, and the page's realtime and poll refresh invalidate that key.

The e2e spend guard now blocks `?action=run` on any `/api/v1` page twin (canvas, studio), as it
blocked `?/run` before.

`photo-studio.spec` fails at "2 photos ready" on dev as well (fake image provider); up to the
redirect into the batch it runs green on this branch.
