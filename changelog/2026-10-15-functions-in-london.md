# Functions run in London, next to the database

Vercel functions ran in `iad1` (no region set) while Supabase `klnswzhhgrqvbfjzioul` is in
eu-west-2. Every auth and DB roundtrip crossed the Atlantic; dashboard `__data.json` TTFB measured
1.3–6 s on desktop fibre. `vercelAdapter` now sets `regions: ['lhr1']`. No route overrides the
region (crons and long routes only set `maxDuration`). Guarded by `function-region.test.ts`.

The root `+layout.server.ts` read `url.hostname`, which makes SvelteKit re-run it on every
client navigation (`x-sveltekit-invalidated=001`): getUser plus two serial `profiles` reads per
click. The read is now under `untrack`, and terms, tour and the publishing flag load in
parallel. Guarded in `src/routes/layout.server.test.ts`.
