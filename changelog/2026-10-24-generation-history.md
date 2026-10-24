# Generation history across projects (FL-15)

**Before:** a generation could only be found from its own node or its own project's Assets.

**Now:** Assets > History lists the org's finished `node_runs` newest first, across every
project, with the output asset, model, date and a link to the source node. Filters: all projects /
this project, and a model. Pagination is keyset on `created_at` (`before`), one extra row tells
whether another page exists. A tile drags onto a canvas through `assetDrag`, like the library.

**Decisions:** no migration: `node_runs` already has the org and FKs to `nodes` and `assets`, so
the project filter rides the `nodes!inner` embed. The index on `node_runs(org_id, created_at)` is
left until the table is large enough to need it. No retention-by-plan: there is no plan limit to
read yet.

**Tests:** `run-history.test.ts`, `tests/e2e/generation-history.spec.ts`.
