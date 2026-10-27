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
