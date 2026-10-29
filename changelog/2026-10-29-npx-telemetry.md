# Anonymous, opt-out telemetry in `npx feega`

We had no signal on how many people run local mode.

- `npx/telemetry.mjs` sends `npx_feega_started` on each start and `npx_feega_active_day` on the
  first start of the UTC day, to PostHog EU with the public project key (same as the app).
- Properties: version, os, arch, node, random install id (`~/.feega/telemetry-id`),
  `$process_person_profile: false`, `$ip: null`, `$geoip_disable: true`. Nothing else.
- Off with `FEEGA_TELEMETRY=0`, `DO_NOT_TRACK=1`, or `CI`/`VITEST` set. One-line notice on first run.
- Fire-and-forget, 1.5 s timeout, no retries, errors swallowed.
- Release: `app-release.yml` bumps and publishes `feega` on every push to main; no manual bump.
