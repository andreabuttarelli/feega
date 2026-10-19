# Mobile app, phase 1: native lists, web canvas (ADR 0018)

`apps/mobile`: Capacitor app, SwiftUI root. Login (email/password against Supabase GoTrue),
projects, canvases per project, canvas in a `CAPBridgeViewController` with the session written as
the `@supabase/ssr` cookie, read back on close so a refresh rotated by the page is not lost.
Lists cached as JSON for offline. Debug perf probe overlay (reveal time, fps, long frames, app
footprint, web process terminations with reload).

Server: `GET /api/v1/me/projects` (standard projects of the active org, `?org=` hint) and
`GET /api/v1/projects/<id>/canvases`. Shapes in `src/lib/api/mobile-contract.ts` (zod);
`npm run mobile:contract` writes `apps/mobile/contract/api.schema.json`, guarded by a vitest and a
Swift test. CLI: `feega projects`, `feega canvases <projectId>`. MCP already had both reads
(`org_query`, `list_canvases`).

Discarded: bundling dashboard pages in the WebView (see ADR); the Supabase Swift SDK (three REST
calls do not need it).
