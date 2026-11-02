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
