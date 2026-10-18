# Free shapes turn as nodes; storage guard; no model spend in e2e

## Turn
After #760 a selected free shape moved and resized as its node, but the
rotate grip still turned the clip inside the node. The grip now turns
the node (`hostTurn`, `Chrome.turns`; `rotateNodeGroup` accepts any kind
that turns — group or element, never a frame). The inline editor stage
follows a turned node (`stageOver`): node size and angle centred on its
on-screen box, not the axis-aligned box.

## Storage
Node 25 exposes a `localStorage` with no methods during server render, so
`localStorage.getItem` threw and the standalone editor returned 500 in
local dev. `$lib/browser-storage` (`localStore`/`sessionStore`) returns a
store only when `getItem` is a function; the SSR-reachable reads use it.

## E2E harness
The `page` fixture aborts and records any unmocked POST to the agent,
node generation, prompt enhance or canvas `?/run`, and fails the spec
(`E2E_ALLOW_SPEND=1` to opt out). Guarded by `model-spend-guard.spec.ts`.

## Specs
`motion-resume-turn` deleted: resuming a running motion-agent turn went
away when the editor chat became the project chat (2026-10-14). Phone
specs follow the Chat tab and the Properties peek on selection; the
editor preview has a background capture player; saves go to `?/ops`.
