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

Follow-up in the same PR:

- A render's hold is a ledger row noted with the run's id, written before the run exists; the
  refund and the charge cap are read from it, once per run (`refundHold` in `credit-hold.ts`).
  Refunds no longer keep the held grants' expiry: credits do not expire since 2026-11-12.
- A provider task is always quoted at submission (provider quote, else the model's pricing) and
  the quote is written through a declared service-role writer. `node_runs_keep_server_values`
  keeps that value out of any session insert or update without refusing the rest of the row.
- `api_keys` deletes: the key's owner, or an org admin (`OrgAction.ManageMembers`). The Settings
  revoke answers 404 when nothing was deleted.
- `commit_motion_revision` with `p_layers` (the overload #2138 adds) is defined here too, as a
  `SECURITY DEFINER` with the same guard; `layers_touched` has no session update grant.
- The tenancy migration is split in `20261114_orgs_read_only.sql` (safe before the deploy) and
  `20261114_team_writes_server_only.sql` (after it).

Deploy order: only `20261114_team_writes_server_only.sql` waits for the app deploy; before it, the
old Team page writes roles and invites with the session. The other five files are safe in either
order. #2138's migration must not redefine the eleven-argument `commit_motion_revision`: applied
after this one, an invoker version comes back and folding fails for sessions. Re-applying
`20261114_history_append_only.sql` restores it.

Renders still running when the app deploys were held under the old note and are not refunded by
the new code; deploy with no render running, or refund those holds by hand.
