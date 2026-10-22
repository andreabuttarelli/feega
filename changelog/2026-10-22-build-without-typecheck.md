# Vercel build no longer reruns the runtime typecheck

`npm run build` ran `scripts/typecheck-runtime.mjs` (full `tsc`, 13 s on
Vercel's 2-core builder) before `vite build`. CI job `test` already runs the
same gate on every PR, and agent PRs merge to `dev` only when it is green;
`main` receives only `dev`. The Vercel run was a duplicate.

`build` is now `vite build`; `npm run typecheck:runtime` still runs it by hand.

Measured on deployment `feega-33h0dhauy` (6m): install 33 s, typecheck 13 s,
vite SSR+client 154 s, adapter-vercel 113 s (nft trace once per function:
catchall, 300 s group, 1800 s agent group), deploy 33 s, build cache 43 s.
Not changed, needs a decision: one `maxDuration` for every route (one trace
instead of three, ~70 s), a larger build machine (vite is CPU bound on 2 cores).
