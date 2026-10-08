# Server rendering closed for everyone

Farm rendering (Vercel Sandbox) will be a paid-plan feature; until then it is closed.

- One switch: `serverRenderOpen()` in `src/lib/motion/server-render.ts`, false today.
- Entry points that consult it: `POST /api/v1/motion/{id}/render` with `mode: "server"` (403
  `server_render_unavailable`, before the credit gate), `startFarmRender` (editor `render`
  action), new `startFarmBatch` (editor `renderBatch`, chat agent `render_batch`), and the
  editor loads (`serverRender.configured`), so the export dialog hides the background option and
  shows its existing "not available" note for farm-only settings. Browser render unchanged.
- MCP `render_video`, CLI `--server` and the skill docs say server mode is unavailable.
- Farm code untouched: `startRender`/`startBatch` still testable directly.

To open it for paid plans: give `serverRenderOpen` the org plan and return `isPaidPlan(plan)`
(`src/lib/plans.ts`) once `orgs` carries a plan; callers already pass through the two
`startFarm*` functions and the API check. Discarded: a `feature_flags` row (a DB round trip for a
value that is constant today).
