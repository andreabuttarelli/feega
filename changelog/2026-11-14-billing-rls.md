# Sessions no longer write billing, membership or history rows

An internal review found that an ordinary signed-in session could write state that decides money
or entitlement straight through PostgREST, because `supabase/baseline/0007_grants.sql` grants
`all` on every public table to `authenticated` and the policies did not narrow it:

- `orgs`: `member_orgs` covered every command, so even a viewer could set `stripe_subscription_id`
  (the definition of a paid team in `billing-tier.ts`) or `store_plan_*`.
- `orgs_members` / `orgs_invites`: an admin could change a role or raise an invite directly,
  skipping the seat check in `team.ts`.
- `credit_ledger` and `ai_calls`: editors could insert, rewrite and delete their org's rows.
- `api_keys`: `org_insert` checked only `org_id`, not whose key it was.
- `canvas_events` (`org_isolation`, all commands) and `motion_revisions` were rewritable history.

The API-key rows tool (`/api/v1/org/rows`) runs with the service role, so no policy applied there.

What changed:

- Four migrations in `supabase/canvas-migrations/20261114_*`, one per concern (tenancy, money
  rows, API keys, history). `orgs` gets no column grant at all instead of a deny-list, so the seat
  columns of #2137 and anything later are closed to sessions by default.
- `commit_motion_revision` (10 args) is now `SECURITY DEFINER` and calls
  `motion_revision_writer`, which refuses a caller that is not an editor of the org or a node that
  is not a motion/element of it. Sessions keep `update (sealed)` only.
- The team route gives `runTeamOp` a service-role `writer` for role changes, invites and resends,
  used after the caller's role was read with the caller's client and the seat check passed.
- The rows tool answers `server_written_table` for `orgs`, `orgs_members`, `orgs_invites`,
  `api_keys`, `ai_calls`, `node_runs`, `canvas_events`.
- `npm run test:billing-rls` loads the whole baseline plus every later migration into pglite and
  probes each write as owner, admin, member, viewer, another org's owner and anon (CI `test` job).
  It also fails on a `SECURITY DEFINER` a session can call that is not in its reviewed list.

Deploy order: ship the app first, then apply `20261114_tenancy_writes_server_only.sql` (before the
app, the Team page's role change and invite fail). The other three are independent of the deploy.
#2138's 11-argument `commit_motion_revision` must also become `SECURITY DEFINER` and
`perform public.motion_revision_writer(p_org_id, p_node_id)` first, or checkpoint folding breaks
once `motion_revisions` loses its session `update`.
