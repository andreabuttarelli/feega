# Start from a website opens the canvas and clones the site

`/start?start_url=` ran a client-side step list: create project, brand analysis, page import.
The brand step (`/api/v1/projects/:id/brand-from-site` → `analyzeWizardSite` →
`runBrandAnalysis`, an OpenRouter crawl with no timeout) ran before the import and was awaited,
so the page sat on "Analysing your brand…" for as long as the model took.

Now `/start` is a server load: check the host is public, `startProject`, 303 to
`/p/<id>/c/<id>?start_url=`. The canvas already turns that param into an auto-running
`UrlImportDialog` (the `import_url` engine, progress, refusal + retry field).

Removed with the path: `/start` page UI, `src/lib/start/*`, `POST /api/v1/start`,
`POST /api/v1/projects/:id/brand-from-site`, `brand-from-site.ts`, `live-brand-ports.ts`,
`brand-kit-frame.ts`. No CLI/MCP used them. `findSiteBrand` stays (palette hint for the import).

Landing hero gets a "Paste any website" field → `oh.feega.app/app?start_url=`.

## Component sets that could not be saved sank the whole import

Live on stripe.com the import read the page, then failed with `transform.x: Too big`. An
instance's offset is a fraction of its host doc (±2). In a component set
(`component-sheet.ts::setDoc`) the host is a tight frame a few hundred px tall, while a nested
instance can sit 600+ px from its own main's content, so the fraction overflows. `placedSets`
placed every set in one plan, so one rejected set threw `DocRejected` and the import reported
failure with the page frame already made.

Now `componentPages` leaves out a set whose doc fails `parseMotionDoc` (its mains stay on the
page) and names it in `skipped`; `placedSets` places sets one by one and a rejected one is
skipped with its reason. The canvas shows `skipped` after a site import. Repro:
`url-plan-saves.test.ts` over the stripe/linear/vercel fixtures (linear failed).
Rejected alternatives: clamping the offset (misplaces the instance); widening the ±2 bound
(an editor range, not the cause).
