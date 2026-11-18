# Inspector audit stops saturating the runners

The audit matrix (6 jobs, 90-minute timeout) sat behind every PR touching canvas or ui sources and
held runners for over an hour per run, so `ci.yml`'s `test` job queued behind it.

Why jobs hung: when the Layers row of a control cannot be clicked (`locator.click` times out
"waiting for element to be visible, enabled and stable"), every following row waits the full
pick timeout too. One job spent 2 minutes per row on 29 consecutive rows.

Changes:
- `timeout-minutes` 90 -> 30 (healthy part: 11 min, part with 8 real failures: 23.5 min).
- `max-parallel: 2` on the matrix.
- The spec stops after 3 rows in a row that could not be reached; the rest fail at once.
- Daily run on `dev` at 04:00 UTC (checks out `dev`; scheduled workflows start from `main`).
- `scripts/local.mjs`, which the audit server imports, joins the path filter.

Kept: the per-PR `concurrency` with `cancel-in-progress`, `continue-on-error`, the path filter.
Not done: fixing the failing rows, which are product defects listed in the PR.
