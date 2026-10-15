# Functions run in London, next to the database

Vercel functions ran in `iad1` (no region set) while Supabase `klnswzhhgrqvbfjzioul` is in
eu-west-2. Every auth and DB roundtrip crossed the Atlantic; dashboard `__data.json` TTFB measured
1.3–6 s on desktop fibre. `vercelAdapter` now sets `regions: ['lhr1']`. No route overrides the
region (crons and long routes only set `maxDuration`). Guarded by `function-region.test.ts`.
