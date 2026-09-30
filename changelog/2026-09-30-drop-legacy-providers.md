# Drop Kie.ai, Browserless, Exa, Tavily, Unsplash and Vercel Sandbox

The canvas product needs none of them. Before: each was an optional integration inherited from
the old product, some already without callers.

- **Kie.ai**: no transport existed anymore, only the name in `model-routing.ts`. The registry now
  knows one endpoint (OpenRouter): `route()` returns a family, `AI_ROUTE_*=x@kie`,
  `GTM_PROVIDER=kie`, `GEMINI_TRANSPORT=kie` are ignored with a warning, `KIE_VIDEO_MODEL_*` is no
  longer read (use `AI_ROUTE_VIDEO_*`). Families served only by kie (`grok`, `gpt` text) are gone,
  with their rates and the kie-Flash pricing guard in `ai-log.ts`. `/api/status` `ai:vision` now
  checks the OpenRouter key.
- **Browserless**: brand analysis reads sites with a plain fetch. The `BrowserRenderer` port in
  `@feega/site-analysis` went with it — one no-op implementation left is not a seam.
- **Exa / Tavily**: `groundedText` (competitors, social handles) now asks OpenRouter with the web
  plugin, which is what `groundedGemini` did; that function had no callers and is removed.
  Without this reroute the chain would have returned empty text on every call.
- **Unsplash**: buyer personas no longer carry a stock photo (`imageUrl` dropped).
- **Vercel Sandbox**: `sandbox.ts`, `sandbox-credits.ts`, `sandbox-leases.ts` had no callers.
  Removed with `@vercel/sandbox`, the image build script and the env block. The
  `sandbox_holders` table stays: migrations are immutable, dropping it is a separate migration.

Sub-processors list and legal checklist updated.
