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
  the quote is written through a declared service-role writer.
- `node_runs` is server-written: no session insert, update or delete, and `params` must be a JSON
  object. `repos/node-runs.ts` writes through the service role after `auth_editor_org_ids()`
  (asked with the caller's client) contains the run's org, and strips server-priced keys from
  caller params.
- Ownership moves through `hand_over_org` (service role only) from the Team endpoint: handing over
  to a non-editor does not add an editor unless the seat gate allows it, and a per-editor team is
  synced after. `transfer_org_ownership` is no longer callable by sessions.
- A session cannot attribute a motion revision or canvas event to another user. The nine-argument
  `commit_motion_revision` (invoker, reached only when the ten-argument one is missing) is dropped.
- `ensureOrgForUser` creates a first org through `createFirstOrg`.
- `signAssetPaths` signs a path only when an asset row the caller can read holds it, and picks the
  bucket from where the path lives (under the row's org: `canvas-assets`; otherwise the maker's
  folder in `brand-knowledge`). A departed member's media still loads. A session can store an
  asset path only under the row's org, its own user folder, or a path the org already holds
  (`20261114_asset_paths_bound.sql`); the rows tool refuses `assets.url`/`proxy_url`.
- `hand_over_org` is created before the deploy (`20261114_hand_over_org.sql`), locks the two rows,
  checks each update, and a partial unique index keeps one owner per org.
- A render hold is refunded when its run cannot be created.
- A video proxy (`assets.proxy_url`) is signed from its row and bound like `url`.
- Generation references are signed only when an asset row of the run's org holds them
  (`signOrgMediaPaths`), and archived feed media only from the node's own folder. A `.feega` import
  drops a relative path that arrives without its file. A run whose wired file the org does not hold
  stops before spending with `reference_out_of_reach`.
- Helpers that sessions call (`asset_path_in_reach`, `auth_*_org_ids`) are granted explicitly.
- `api_keys` deletes: the key's owner, or an org admin (`OrgAction.ManageMembers`). The Settings
  revoke answers 404 when nothing was deleted.
- `commit_motion_revision` with `p_layers` (the overload #2138 adds) is defined here too, as a
  `SECURITY DEFINER` with the same guard; `layers_touched` has no session update grant.
- The tenancy migration is split in `20261114_orgs_read_only.sql` (safe before the deploy) and
  `20261114_team_writes_server_only.sql` (after it).

Deploy order: `20261114_team_writes_server_only.sql` and `20261114_runs_server_written.sql` wait for
the app deploy; before it, the old app writes roles, invites and runs with the session. The other
six files are safe in either order, and `20261114_hand_over_org.sql` must be applied before the
deploy, since the new Team page calls it. `20261113_agent_edit_counts.sql` (#2138, unapplied everywhere) no longer defines the
eleven-argument `commit_motion_revision`: `20261114_history_append_only.sql` is its only
definition, so the two apply in either order. The harness re-applies the unapplied siblings
after the hardening and runs every probe again.

Renders still running when the app deploys were held under the old note and are not refunded by
the new code; deploy with no render running, or refund those holds by hand.
