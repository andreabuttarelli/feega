---
title: Data model
description: Tables and the constraints that are not obvious from names.
sidebar:
  order: 1
---

Summary of the schema notes in `CLAUDE.md`. The full design, with the reasons for each choice, is [`NEW_DATABASE_STRUCTURE.md`](https://github.com/andreabuttarelli/feega/blob/main/NEW_DATABASE_STRUCTURE.md) (written in Italian).

| Group | Tables |
|---|---|
| Tenant | `orgs`, `orgs_members`, `orgs_invites`, `profiles`, `api_keys` |
| Canvas | `projects`, `canvases`, `nodes`, `nodes_connections`, `node_runs`, `assets`, `canvas_events` |
| Agents | `chat_threads`, `chat_messages`, `ai_calls` |

The canvas Brands panel reads `brands` (with `palette`, `voice` and `logos`), `brand_fonts` (a role per brand, pointing at an uploaded `org_fonts` row or a Google Fonts family), `brand_pins` (each user's pinned brands), `assets.brand_id`/`approved_at` (approved assets), `products`, `posts`, `social_accounts`, `social_posts` (linked with `brand_id`) and `competitor_ads`. The other tables of the earlier social product (`post_sources`, the remaining `ad_*` tables, `influencers`) are not documented here. `scheduled_posts` was dropped: Zernio holds the schedule.

## Constraints worth knowing

- `org_id` is on every org table; row-level security uses `auth_org_ids()`. The service-role key bypasses it, so every use is declared in `src/lib/server/db/service-role-uses.ts`.
- `nodes.data` is `jsonb`, shaped per node type.
- `nodes.version`: position is last-write-wins; `data` uses optimistic concurrency (`where version = expected`; zero rows is a conflict).
- `nodes.deleted_at`: soft delete; every read filters `deleted_at is null`.
- `actor_kind`, `actor_id`, `agent_key` wherever an action is recorded. For an agent, `actor_id` is the user it acts for.
- `nodes_connections.target_handle`: a video with start and end frames has two inputs.
- Realtime publishes `nodes`, `nodes_connections`, `canvases`, `node_runs` with `replica identity full`.
- Types are generated (`npm run db:types`), never hand-written.

## Rows a session reads but never writes

Billing, membership and history are decided by the server, not by the signed-in user. With an ordinary session:

| Table | A session can |
|---|---|
| `orgs` | read its orgs; no column is writable, so a billing or seat column added later is closed by default |
| `orgs_members` | read the team; an admin removes a member, anyone leaves. Role changes go through the team endpoint |
| `orgs_invites` | admins list and revoke. Creating or renewing an invite goes through the team endpoint |
| `credit_ledger`, `ai_calls` | read its org's rows |
| `api_keys` | an editor creates and deletes keys in their own name only; a key is never rewritten |
| `canvas_events` | read; an editor appends. Nothing updates or deletes |
| `motion_revisions` | read, append, seal. Folding an edit into the head goes through `commit_motion_revision`, which refuses a non-editor |

The MCP rows tools (`insert_row`, `update_row`, `delete_row`) refuse the same tables plus `node_runs` with `server_written_table`. `npm run test:billing-rls` proves each rule in pglite against `supabase/baseline` and every later migration.
