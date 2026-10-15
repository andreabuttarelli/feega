# API routes honour the uncensored lock

Security fix. The older `/api/v1` motion and node routes found the node by org and id only, so an
org member's API key or JWT reached frames, runs, renders, media and embeds of an uncensored
project the member could not open. #590 closed `/org/canvas`, #591–#595 `/motion/[id]/ops` and
`/poster`; the rest stayed open.

Now one gate, `src/lib/server/org-data/reach.ts`, sits between the caller and every Bearer route
that names a node, run, asset or project: `reachableCaller` (ids in the path or query) and
`callerReach` (ids in the body). It reads `hiddenFor` — the same lock-aware scope `/org/query` and
`/org/rows` already filter with — and answers `404 { error: "not_found" }`, indistinguishable from
a missing row. When nothing is hidden it costs one lock read.

Routes behind it: `/motion/[id]` and `revisions` `render` `tools` `frames` `templates` `embed`
`embed/bundle` `ask` `storyboard` `budget`; `/motion/runs/[id]`, `/motion/renders/[id]`;
`/motion` (list: `?project=` refused, other locked videos filtered), `/motion/elements`,
`/motion/from-template`; `/org/nodes/[id]/generate|loop|apply-effects|effects-pair`;
`/org/media`; `/gallery/publish`, `/gallery/[id]/remix`. `from-template` without a project now
defaults to the newest *standard* project, not the newest of any mode.

Already locked, untouched: `/org/canvas` (`canvasReachable`), `/motion/[id]/ops|poster`
(`callerMotionScope`), `/projects/[id]/**` and attachments (`findReachableProject`), `/org/query`
and `/org/rows` (`hiddenFor`).

Public links keep their own token rules: `/s/[token]` re-checks the project mode on every read
(`Capability.Share`); `/d/[token]` and canvas shares block the switch to uncensored while live;
`publishEmbed` refuses an uncensored project. Known gap, not fixed here: a motion embed published
while the project was standard is a storage file the mode switch does not check, so it stays
public after the switch.

Discarded: a per-route `canvasReachable` call (the copy #590 made once), and resolving through
`callerMotionScope` everywhere (it needs a motion node; runs, assets and projects do not have one).

Guard: `src/routes/api/v1/uncensored-lock.test.ts`, one row per route.
