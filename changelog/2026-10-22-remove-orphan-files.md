# Remove orphan modules

`knip` (entries: routes, hooks, scripts; tests excluded so test-only
modules count as dead) listed 28 files no route reaches: old-product
components (AgentAvatar/Stack, PlanCards, UpgradeLink, CountryPicker,
ConnectAgentDialog, Project/VideoCard, AnimatedNum), unused shadcn parts
(sidebar, label, separator, skeleton, spinner, is-mobile), a superseded
`motion/CoreTextEdit.svelte`, `peaks.worker.ts`, `gpu/kill.ts`, and server
modules `documents`, `media-origin`, `media-library-tools`,
`design-visual-refs`, `brand-agent/system-prompt`, `projects/request-scope`,
`stores/theme`, `talent-labels`, `links`.

Kept although knip lists them: workers and bundle entries loaded by URL or
by `scripts/motion-bundles.ts`, the vitest setup file, the
`feega-motion-react` example.

Not done: knip reports ~960 unused exports in reachable modules; many are
exported for tests. Left for a separate pass.
