# Frame session: canvas and memberships in parallel

Production `frame_open_timing` (14 days, WebKit only so far): session p50 725 ms, p90 1.6 s;
shown p50 1.2 s. The session endpoint's `scope` was serial: memberships, then the canvas (one query
per org), then the parallel batch.

`openCanvasForUser` (`src/lib/server/canvas/lookup.ts`) reads memberships and the canvas by id
together, then refuses a canvas whose `org_id` is not among the memberships — tenancy stays
checked in code, not left to RLS. Local (Mac → Supabase), 5 requests: scope 140–173 → 62–125 ms,
total 295–335 → 201–271 ms.

Next: `motionAssets` (list then sign, ~130 ms) is the slowest branch of the batch.
