# A scorecard for code import on real repositories

`npm run eval:code-import` scores code import on nine public repos pinned to a sha
(`scripts/eval/code-import/corpus.ts`; the four repo apps of `fidelity-apps.ts` are folded in).
Dry run by default: prints the plan, the worst-case cost ($0.06/repo, 6 min × 4 vCPU from
`sandboxUsd`) and every metric as `unrun: dry run`. `--spend` (cap `--cap`, default $1) posts
each repo to the hosted `/api/v1/projects/:id/code-import`; `--compare=<dir>` prints deltas.

Expected routes and component-file counts come from the GitHub tree at the pinned sha; the
counting rules are printed in every summary. Route recall stays `unrun` until route discovery
exists. Token coverage, linked instances, install/ready ms and fidelity stay `unrun` in a live
run too: the API reports none of the denominators or timings, and fidelity needs the capture +
`drawStill` pass of `code-fidelity.browser.test.ts`.

Never run against a real repo yet.
