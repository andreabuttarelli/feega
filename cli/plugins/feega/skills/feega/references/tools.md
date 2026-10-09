# feega MCP tools ↔ CLI

Twelve tools, all reachable through the org you belong to — no `slug` required on any of them,
because the canvas is org-scoped and a brand is only a `brand_id` value inside it. Ids accept short
unambiguous prefixes on list-derived reads; a `where` on `id` in `delete_row` and `update_row`
takes the full id, because an ambiguous prefix would touch the wrong row and neither comes back.

The CLI is narrower: it is brand-scoped (`feega <command> <slug>`) and does not expose `query`,
`insert_row`, `update_row`, `delete_row`, `describe_node_types` or `run_node_generation` — those
are MCP only, because they reach the whole database directly, which the CLI's fixed set of
brand-scoped REST endpoints does not.

## Auth

| MCP | CLI |
|-----|-----|
| (none — the host does OAuth on HTTP, `feega login` locally) | `feega login` / `feega logout` |
| — | `feega brands` |

There is no sign-in tool. On remote HTTP the host walks the OAuth round itself; on stdio the
session is the CLI's, so `feega login` in a terminal covers both. Confirm with `query` on
`brands` (MCP) or `feega brands` (CLI): rows come back, or nobody is signed in.

## Reading is one tool

| MCP | CLI |
|-----|-----|
| `query` | (MCP only — the CLI's reads are the fixed commands below) |

`query` reads ANY table your org can see, **as you**: the request runs with your own session, so
Postgres RLS returns exactly the rows you would see in the app and nothing more. It is READ ONLY by
construction — you name a table, columns and filters, it issues one PostgREST read, and a write has
nowhere to go. No SQL string, no joins, no function calls. It calls no model and costs nothing.

### The whole shape

- **`table`** — omit it and you get the list of every table you can name. Ask for a table with no
  `columns` and you get real rows with every column: the keys of a row ARE the schema.
- **`columns`** — **always name them.** Without them every column comes back, the character cap
  drops whole rows to fit, and a long question gets a short answer.
- **`where`** — filters ANDed together, each `column` / `op` / `value`, where `op` is one of `eq`,
  `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`, `in`, `cs`, `cd`. `in` takes an array,
  `is` takes null / true / false. **`negate: true` inverts that one filter**, which is how `is
  null` becomes `is not null`.
- **`order`** — one column or an array of them, applied in that order. Descending unless
  `ascending` is set, and `nullsFirst` decides where the empty values sit.
- **`embed`** — a related table brought along through its foreign key, with its own `columns`. RLS
  applies to it too: a post with the nodes it came from arrives in one call.
- **`offset`** — the next page. When rows were dropped, `limits` in the reply names the offset that
  resumes the read.
- **`count`** — `"estimated"` (the planner's guess, the default) or `"exact"`, which counts the
  matching rows for real and puts the number in `total`. Use it when the number IS the answer.
- **`limit`** — 20 by default, **200 at most**.
- **`org`** — which org, only if you belong to more than one. Omit to use the default; an API key
  ignores it, because its org is fixed by the key.

**One row is a document.** With `limit: 1` long text comes back whole — that is how you read a
node's full prompt or a post's full caption before rewriting it. With many rows long values are cut
at 2 000 characters and `limits` names the columns that were cut. Every cap that bites is named
there; none of them is silent.

One table per call plus whatever `embed` brings: read two unrelated tables and match the ids
yourself. A refusal comes back as `200` with `error`, `message` and often `fix` inside, so you can
read why and change your call.

### Where the reads went

| you want | how |
|---|---|
| your projects/brands | `query` on `brands` — `id`, `slug`, `name`, `plan`, `status`; CLI `feega brands` |
| the brand at a glance | `feega dashboard <slug>` and `feega status <slug>` — no single table stands in for them |
| a project's canvases | `query` on `canvases` — `id`, `name`, `project_id`, `viewport`, filtered `project_id` `eq` |
| the nodes on a canvas | `query` on `nodes` — `id`, `type`, `data`, `version`, filtered `canvas_id` `eq` and `deleted_at` `is` null |
| a node's connections | `query` on `nodes_connections` — `source_node_id`, `target_node_id`, `target_handle`, filtered on the canvas's node ids |
| ad campaigns | `query` on `ad_campaigns` — `id`, `name`, `status`, `budget_amount`, `budget_type`, `approved_by`; CLI `feega ads <slug>` |
| products | `query` on `products` — `id`, `title`, `pricing`, `url`, `featured`, `images`; CLI `feega products <slug>` |
| connected accounts | `query` on `social_accounts` — `platform`, `username`, `status`, `connected_at` |
| what `nodes.data` must look like | `describe_node_types` — not a `query`, since it reads a schema, not a table |

## Writing a row that has no tool of its own

| MCP | CLI |
|-----|-----|
| `insert_row` | (MCP only) |
| `update_row` | (MCP only) |
| `delete_row` | (MCP only) |
| `describe_node_types` | (MCP only) |

`insert_row`, `update_row` and `delete_row` are `query` turned around: the same session, the same
tables, the same absence of SQL — and the same consequence, that what they cannot express does not
happen. There is no upsert.

`insert_row({ org, table, values })` adds one row. `org_id` is filled in for you; naming a
different one is refused rather than quietly corrected. It never replaces anything: a row that is
already there comes back as a collision naming the key you hit, and changing it is `update_row`.
Several jsonb columns are checked against a real shape before writing — `nodes.data` by `type`
(call `describe_node_types` first), `posts.media`, `ad_campaigns.targeting`/`placements`,
`canvases.viewport` — a rejection names the exact field.

`update_row({ org, table, where, values })` changes rows that exist. **Only the columns you send
are touched** — everything else in the row is left exactly as it was. `where` is required and may
not be empty, at most 50 rows move per call, and the rows are counted before anything is written,
so "nothing matched" comes back as a refusal instead of a cheerful success.

`delete_row({ org, table, where })` removes rows, and **this does not come back**. `where` is
required and may not be empty — a delete with no filter would empty everything you can reach. The
ceiling is **10 rows per call**, and it is not a truncation: the matches are counted BEFORE
anything goes, so a filter that hits eleven is refused whole and you are told how many it hit.

`describe_node_types({ org, type? })` returns the JSON Schema `insert_row`/`update_row` actually
enforce on `nodes.data`, per `type` (`text`, `image`, `video`, `doc`, `iframe`,
`social_account_feed`, `social_post_mockup`, `products`, `ads`, `influencer`, `list`, `select`,
`effects`). Omit `type` for all thirteen at once. Model/aspect-ratio/duration limits are NOT here
— call `run_node_generation` and read its refusal, or check the model's own docs, since those are
a fact of the model, not the node.

`effects` holds a stack of image filters (pixelate, posterize, duotone, dither, halftone, noise,
rgb-shift, glitch, wave, swirl, pinch, ascii, random-colors, shape-mosaic, shape-cutout) over an
upstream image — the schema returned for it lists every effect's params with their
ranges/options/defaults (`list_effects` gives the same list). `apply_effects` sets and renders it.
`shape-cutout` yields one side of an A/B pair (`side: shapes` = shapes over the image, `side: holes`
= solid fill with windows): `make_effects_pair` creates the other side.

## Generation

| MCP | CLI |
|-----|-----|
| `run_node_generation` | (MCP only — the canvas UI's Generate button is the equivalent, not a CLI command) |
| `enhance_prompt` | (MCP only) |
| `get_media` | `feega media --node <id> --run <id> --asset <id>` |

`enhance_prompt({ org, prompt, model, shot_mode? })` rewrites a brief into the shape the given
model wants — labelled sections, one paragraph, a command when editing, whatever that model's
craft calls for. It rewrites, it never invents: a rewrite that adds a subject, asks for readable
text or states an aspect ratio is thrown away, and the original comes back with `changed: false`
and why in `notes`, same as a model with no guide. No brand, no draw, no file — spends credits.

`run_node_generation({ org, node_id, medium, prompt, model, version, params? })` fills an existing
canvas node — it never creates one (`insert_row` does that). `medium` (`text`, `image` or `video`)
must match the node's own `type`, or the call is refused before anything is spent. `version` is
optimistic concurrency: pass the node's current `nodes.version`, and a stale value comes back
`conflict` rather than a silent overwrite — re-read the node with `query` and retry with the fresh
version.

A `video` never returns finished here: it comes back `queued` with an `external_job_id` on the
run, and the render lands later, asynchronously — the node stays `running` until a later tick
deposits the asset. Poll the node (`query`) rather than expecting a file now. Spends credits; a
`credits_exhausted` failure means the org is out. A finished image or text comes back with
`asset_ids` and `media` (the `get_media` links for it).

`get_media({ org, node_ids?, run_ids?, asset_ids? })` resolves nodes (their current output), runs
(what that run produced) and assets to: type, mime, width/height, duration, and two signed links
— `preview_url` (images only, 1024px long edge, valid 5 minutes: fetch it to see the image)
and `full_url` (the original, for the user, valid 1 hour). Ids outside your org come back in `missing`; nothing
visible at all is a 404. Reads only.

`list_effects({ org })` lists every effect and its params. `apply_effects({ org, node_id, effects? })`
on an image node creates a wired `effects` node and renders `effects` into it; on an `effects` node
it replaces the stack when `effects` is given, then renders. `make_effects_pair({ org, node_id })`
creates and renders the A/B twin of a `shape-cutout` node. All return `{ node_id, asset_id }` and
spend no credits.

`write_effect` (`{ org, name, frag, params? }`) stores a custom shader effect for the workspace (same
name replaces it): `frag` defines `vec4 effect(vec2 uv)` over `u_src`, `u_res`, `u_time`, `u_seed`,
`hash`, `noise`, and each param becomes `u_<key>`. It returns `{ effect }` with its check: `passed`,
`failed` with `problems`, or `unchecked`. `patch_effect` (`{ org, effect_id, version, edits?, params? }`)
applies `[{ find, replace }]` edits; a stale `version` is a 409. `list_effects` returns them under
`custom` with the `step` (`{ id: "custom", ref }`) that `apply_effects` takes. Free.

`write_layout` (`{ org, name, spec }`) stores a custom composition layout: `spec` is `{ kind: "spec",
slots, place, camera?, motion?, params?, tilt?, scale?, animate? }` with `place` a grid, ring, line or
scatter. `patch_layout` (`{ org, layout_id, version, spec }`) replaces it; `list_layouts` lists them.
Free.

## Node loops

| MCP | CLI |
|-----|-----|
| `run_node_loop` | (MCP only) |
| `preview_node_loop` | (MCP only) |
| `cancel_node_loop` | (MCP only) |

`run_node_loop({ org, node_id, confirm? })` queues every combination from a node's `iterate`
wires (or a plain "repeat N" when it has none) through the same engine as `run_node_generation` —
one real run per combination, never a copy of it. It returns as soon as the queue is written, NOT
when the results exist: combinations run a few at a time as a background tick drains the queue
over the following minutes. Up to 50 queues directly; above 50 it comes back `needs_confirmation`
with the count and the credit cost — call again with `confirm: true`; above 1000 it is refused
outright and the loop must be split. Credits for the whole loop are checked up front, not
discovered empty halfway. A failed combination never stops the others; results land in an output
`list` node next to this one as they finish, each item labelled with which values produced it —
poll that node (`query`) to see progress.

`preview_node_loop({ org, node_id })` reads how many combinations `run_node_loop` would queue
right now and what they would cost. Spends nothing — call it before `run_node_loop` when the
count is not already known, rather than guessing at whether `confirm` will be needed.

`cancel_node_loop({ org, node_id })` stops the combinations still queued for this node — the ones
a tick has already claimed finish regardless, and anything already produced stays in the output
list. Returns how many combinations it actually stopped.

## Motion videos

| MCP | CLI |
|-----|-----|
| `list_motion_videos` | `feega motion list [--project <id>]` |
| `ask_motion_agent` | `feega motion ask <nodeId> "<prompt>" [--no-wait]` |
| `get_motion_run` | `feega motion run <runId>` |
| `get_motion_summary` | (MCP only) |
| `render_video` | `feega motion render <nodeId> [--resolution 720p] [--quality q] [--fps n]` |
| `get_render` | `feega motion render-status <runId>` |
| `publish_motion_embed` | `feega motion embed <nodeId> [--unpublish]` |
| `get_motion_embed` | `feega motion embed <nodeId> --status` |
| `view_motion_frames` | `feega motion frames <nodeId> --at 1,2.5,4 [--width 640] [--out dir]` |
| `list_motion_revisions` | `feega motion revisions <nodeId>` |
| `restore_motion_revision` | `feega motion revisions <nodeId> --restore <version>` |
| (CLI / API only) | `feega motion embed <nodeId> --download <file>` |

`list_motion_videos({ org, project_id? })` lists `motion` nodes newest first: `node_id`, `name`,
`project_id`, `canvas_id`, `format`, `version` (0 = empty), signed `poster_url` /
`last_render_url` (one hour) and `editor_url`.

`ask_motion_agent({ org, node_id, prompt, wait? })` runs one turn of the motion editor's agent on
a `motion` node, with the editor's own tools, and saves a new revision. It returns at once with
`{ run_id, status: "running" }`; poll `get_motion_run({ org, run_id })` until `done`, which carries
`reply`, `summary`, `version` and `cost_usd`. `wait: true` polls for you, up to about 4 minutes of a turn that can run up to 30. The agent
looks at its own frames even with no editor open. Spends credits. For a launch film it
rebuilds the product UI as vector components (UI kit or `recreate_ui` from a site capture),
never as screenshots: asking "recreate the dashboard from the capture" works.

`get_motion_summary({ org, node_id })` reads the saved video: revision, last change, size, fps,
duration, tracks and clips in seconds. Spends nothing.

`render_video({ org, node_id, mode?, resolution?, format?, quality?, fps? })` renders the saved revision. Default
`mode: "browser"`: free, returns `{ render_url, run_id, expires_at, credits: 0 }`. The link works
once, expires in 30 minutes if nobody opens it, and is claimed by the first device that opens it;
that device renders, saves the MP4 to the project and closes the run. `mode: "server"` is not
available yet: it is refused with 403 `server_render_unavailable`. `get_render({ org, run_id })` returns
`status`, `mode`, `asset_id` and a signed `file_url` (one hour) once `done`.

`publish_motion_embed({ org, node_id, action? })` hosts the interactive web export of the saved
revision and returns `{ published, url, snippet, revision }` — the snippet (feega's loader script
plus `<feega-motion src="id">`, or `<div data-feega="id">`) goes into any site and fills 100% of
its box (`fit="contain"` to letterbox); live components (games, generative pieces) run live there and get keys and taps, while a video
render shows only a still of them. Publishing again updates the same URL; `action: "unpublish"` removes it. Free. Uncensored
projects get 403 with `refusal`; an empty video 409. Playback and scroll length are read from feega,
not the snippet: a scrub embed builds its own sticky section of the saved scroll length.
Opened alone, the embed page scrolls itself. `get_motion_embed({ org, node_id })` reads
`published`, `url`, `snippet`. The self-contained HTML is `GET /api/v1/motion/{node_id}/embed/bundle`.

`view_motion_frames({ org, node_id, times, width? })` draws the saved revision at up to 6 times
(seconds, inside the video) in a server-side browser and returns each frame as an MCP image, plus
`quality` (every problem the editor agent's quality gate finds) and `blocking` (the ones to fix
before delivery). `width` is the longest side, default and max 960. Free, read-only, about 10 calls
a minute per workspace (429 past that); bad times 400, empty video 409. API:
`POST /api/v1/motion/{node_id}/frames` `{ times, width? }` → `{ revision, frames: [{ time, mime, data }], quality, blocking }`.

## Gallery

| MCP | CLI |
|-----|-----|
| `search_gallery` | `feega gallery [query] [--kind] [--format] [--duration] [--tag]` |
| `remix_gallery_item` | `feega gallery remix <itemId> --project <id> [--canvas <id>]` |
| `publish_to_gallery` | `feega gallery publish <nodeId> --title "…" [--description] [--tags a,b]` |
| — | `feega gallery withdraw <itemId>` |

`search_gallery({ query?, kind?, format?, duration?, tag? })` lists published items, newest first:
`id`, `title`, `author`, `kind`, `format`, `seconds`, `tags`, `remixes`, `remix_of` and `url`.
Reads only, needs no org.

`remix_gallery_item({ org, item_id, project_id, canvas_id? })` copies the item's doc and files into
`project_id` as a new `motion` node (on `canvas_id`, or on the Motion canvas) and returns `node_id`
and `editor_url`. The main texts, colours, logo and media become fields, like a template. The
original keeps its count of remixes; withdrawing it later never touches the copies. Free.

`publish_to_gallery({ org, node_id, title, description?, tags? })` publishes the saved revision of a
`motion` node: its files are copied to a public folder, so the item never depends on the author's
permissions. Refused with `uncensored_not_publishable`, `real_brand_not_publishable`,
`brand_logo_not_publishable`, `site_material_not_publishable` or `moderated`. Free.

## Ads

| MCP | CLI |
|-----|-----|
| `list_ad_campaigns` | `feega ads <slug>` |
| `create_ad_campaign` | Promote → Paid ad, in the app |
| `approve_ad_campaign` | `feega ads <slug> --approve <id>` |
| `set_ad_campaign_status` | `feega ads <slug> --pause <id>` / `--resume <id>` |

Ads are Meta only (Facebook + Instagram). An ad campaign spends real money, so
`create_ad_campaign` never produces something already running: it always drafts `draft`,
`approved_by: null`. `approve_ad_campaign` is the only door that launches it, and it is refused
over an API key on purpose — an agent cannot approve its own spend. This only works from a
signed-in person's own session (the app, `feega login`, or the MCP host doing OAuth). If you are
an agent and this fails, tell the person to approve it themselves.

`list_ad_campaigns({ org, brand_id, status? })` reads a brand's campaigns with their status and
whether a human has approved them yet. Free.

`create_ad_campaign({ org, brand_id, ad_account_id, objective, budget_type, budget_amount, days,
countries, placements, primary_text, headline, age_min?, age_max?, gender?, call_to_action?,
link_url?, node_ids?, post_id? })` drafts a campaign and its creative. `objective` is `traffic`
(needs `link_url`), `engagement` or `awareness`. `node_ids` are canvas image/video nodes;
`post_id` boosts a published post instead. Free.

`approve_ad_campaign({ org, id })` launches a drafted campaign on Meta and charges the fee.

`set_ad_campaign_status({ org, id, next })` pauses (`paused`) or resumes (`active`) it.
