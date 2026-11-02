# Core usage analytics

PostHog only saw pageviews, onboarding and timings: nothing said whether people build and ship.
Ten server-side events now fire where each action lands (after the DB write or the export file is
saved), so a failed or conflicting write is never counted.

- Registry: `src/lib/core-usage.ts` (names, props, debounce, motion op → kind table).
- Sender: `src/lib/server/core-usage.ts`, personless (`$process_person_profile: false`, no IP),
  `distinct_id` = user id; off in dev and Vercel preview/development.
- `frame_edited` / `motion_edited`: once per user+frame(+kind) per server instance.
- Local mode (`npx feega`): the launcher passes the anonymous install id to the app server, which
  sends only `frame_created` and `export_completed`; `FEEGA_TELEMETRY=0` / `DO_NOT_TRACK=1` stop it.
- Active user = `export_completed` in the week.

Not covered yet: loop/workflow generations (`completeRun` in loop.ts/workflow.ts), browser-only
exports, the internal-viewer opt-out (server events skip it), cookie consent (server events are
personless product telemetry, not browser trackers).
