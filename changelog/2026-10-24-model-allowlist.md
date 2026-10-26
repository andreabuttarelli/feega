# Org model allow-list

**Before:** every org saw every synced image, video and 3D model, and any of them could run.

**Now:** `org_model_allowlist` (migration in #1253, applied separately) holds, per org and
medium, the ids an org offers. No rows for a medium = every model. `offerableModels` takes an
optional `orgId` and filters; `runGenNode` refuses a model off the list with
`MODEL_NOT_ALLOWED` before any spend; `canvasModelAccepts` (no-brand image and video) passes the
org; `projectCatalogue` hides unlisted models from the pickers. Admin API
`/api/v1/org/model-allowlist` (GET members, PUT owners/admins), Settings > Models, CLI
`feega allowlist [set <medium> [ids...]]`, MCP `model_allowlist`.

**Decisions:** a missing table (migration not applied) reads as "no list", so this ships before
the migration. Text models are not restricted: the chat picker has its own listing. The cached
global catalogue is filtered per org after the cache, not keyed by org.

**Tests:** `allowlist.test.ts`, `offerable-models.test.ts`, `generate.model3d.test.ts`,
`project-catalogue.test.ts`, route test, settings page test, CLI api test.
