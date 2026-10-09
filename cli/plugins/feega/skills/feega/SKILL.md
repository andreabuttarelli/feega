---
name: feega
description: >-
  Operate feega (motion videos on an infinite canvas) via MCP tools or the
  feega CLI: motion videos, canvas nodes, generation, gallery, ad campaigns.
  Use when the user mentions feega, feega.app, a feega canvas or video, or
  managing brand content and ads from an agent.
license: Apache-2.0
compatibility: >-
  Requires network access to feega.app (or PUBLIC_APP_URL). Prefer feega MCP
  when connected; otherwise the feega CLI (Bun or installed binary) after OAuth login.
metadata:
  author: andreabuttarelli
  version: "2.0.0"
  homepage: https://feega.app
  repository: https://github.com/andreabuttarelli/feega
  mcp: https://mcp.feega.app/mcp
---

# feega

Drive [feega](https://feega.app) — an infinite canvas of typed nodes (text, image, video, doc,
iframe, social feed, social post mockup, products, ads) — through **MCP tools** (preferred) or the
**`feega` CLI**. Same OAuth identity. **No static API tokens.**

## Choose interface

| Situation | Action |
|-----------|--------|
| feega MCP is connected | Call MCP tools (`query`, `ask_motion_agent`, `run_node_generation`, …) |
| MCP not available | Shell: `feega …` after `feega login` |

MCP reaches the whole org: any project, canvas, node or ad campaign the signed-in user can
see. The CLI is narrower — it is the fallback for motion, gallery and ads without a connected
agent. Never invent REST endpoints or API keys.

## Auth (always OAuth)

**Signing in is not a tool** — there is nothing to call. Two paths, and both end in the same JWT:

1. **Local MCP / CLI:** run `feega login` in a terminal, once. The session lands in
   `~/.config/feega/session.json` and the CLI and the MCP server share it.
2. **Remote MCP** (`https://mcp.feega.app/mcp`): your host does the OAuth round itself — it reads
   `/.well-known/oauth-protected-resource` and answers the `401 WWW-Authenticate: Bearer`
   challenge. Nothing for you to do; a missing Bearer is a 401, not a broken server.

Confirm it worked with `query` on `projects` or `feega brands`: rows come back, or you are not
signed in.

Setup details: [references/mcp.md](references/mcp.md).

## Operating rules

1. **Never guess an org, a brand or a project.** Most calls default to the caller's own org and
   need nothing named; the tools that DO need a `brand_id` or `project_id` take it as an input —
   read it back with `query` first (recipe below), never invent one. Guessing spends a real
   organisation's credits and writes into a real client's canvas.
2. Ad campaign ids accept short unambiguous prefixes from list output — never guess
   if ambiguous.
3. `run_node_generation` needs the node's current `version` (optimistic concurrency): read the
   node with `query` first, pass that number, and if the call comes back `conflict`, re-read and
   retry — never assume your write landed.
4. An ad campaign always drafts unapproved. `approve_ad_campaign` only works from a signed-in
   person's own session — an API key (an agent acting alone) is refused on purpose. If you are an
   agent and this fails, tell the person to approve it themselves.
5. Confirm before deleting unless the user clearly asked: `delete_row` does not come back.

## Reading is one tool

**`query` is the read.** Every table your org can see — projects, canvases, nodes, connections,
assets, posts, ad campaigns, products, social accounts — the request runs with your own session,
so Postgres RLS returns exactly the rows you would see in the app and nothing more. Read only, no
credits, no model. Omit `table` to list what you can name; ask for a table with no `columns` and
the keys of a row are the schema.

**Always name `columns`.** Without them `query` returns every column, the character cap then drops
whole rows to fit, and a long question gets a short answer.

**Nothing is out of reach.** `offset` is the next page. `count: "exact"` when the number IS the
answer. `negate: true` on a filter turns `is null` into `is not null`. `order` takes several
columns and `nullsFirst`. `embed` brings a related table along through its foreign key, with RLS
applied to it too.

**One row is a document.** With `limit: 1` long text comes back whole. With many rows long values
are cut at 2 000 chars and `limits` says in which columns.

### The queries you will actually need

| you want | call |
|---|---|
| which projects/brands you have | `query({table:"brands", columns:["id","slug","name","plan","status"]})` |
| a project's canvases | `query({table:"canvases", columns:["id","name","project_id"], where:[{column:"project_id",op:"eq",value:"…"}]})` |
| the nodes on a canvas | `query({table:"nodes", columns:["id","type","data","version","canvas_id"], where:[{column:"canvas_id",op:"eq",value:"…"},{column:"deleted_at",op:"is",value:null}]})` |
| a node's current version (before generating into it) | same read, `limit:1` on the node's `id`, read back `version` |
| ad campaigns and their spend | `query({table:"ad_campaigns", columns:["id","name","status","budget_amount","budget_type"], where:[{column:"brand_id",op:"eq",value:"…"}]})` |
| what a brand sells | `query({table:"products", columns:["id","title","pricing","url","featured"]})` |
| connected social accounts | `query({table:"social_accounts", columns:["platform","username","status"]})` |

**A row in a table nothing else writes** → `insert_row`, `update_row` and `delete_row`, `query`
turned around. `insert_row({table, values})` adds one row; `org_id` is filled in for you, and a
row that already exists comes back as a collision instead of replacing anything. `update_row({table,
where, values})` touches only the columns you send and needs a non-empty `where`, at most 50 rows a
call. `delete_row({table, where})` removes rows from your org, needs a non-empty `where` too, at most
10 rows a call, and it does not come back. `describe_node_types` gives the JSON Schema `nodes.data` must match per `type`
before you insert or update one — call it before writing a node's `data`.

## Generate into a node

`run_node_generation` is the canvas **Generate** button, for an agent: it fills an existing node
with text, image or video — it never creates a node (`insert_row` does that). `medium` must match
the node's own `type`, or the call is refused before anything is spent. Pass the node's current
`nodes.version`; a stale value comes back `conflict`, never a silent overwrite. A `video` never
returns finished here — it comes back `queued` with an `external_job_id`, and the render lands
later on a tick you do not control: poll the node with `query` rather than waiting on this call.
Spends credits; `credits_exhausted` means the org is out. A finished result carries `asset_ids` and
`media` with the same two links `get_media` returns.

## See what a node holds

`get_media({ node_ids?, run_ids?, asset_ids? })` returns, per item, type, mime, size, duration and
two short-lived signed links: `preview_url` (images, 1024px long edge) — fetch it to look at the
result and judge it against the prompt — and `full_url`, the original file, to give the user.
Videos have `full_url` only. Ids your org cannot see come back in `missing`. Free.

`enhance_prompt` rewrites a brief into the shape the model you are about to render with wants —
pass `model`, use the `prompt` it returns. It rewrites, never invents: a rewrite that changes the
subject or states an aspect ratio is thrown away, `changed: false`, reason in `notes`. Spends
credits.

## Apply image effects

`list_effects` lists every effect (pixelate, duotone, glitch, shape-mosaic, shape-cutout, …) with
its params. `apply_effects` with `node_id` and `effects` on an image node creates an `effects` node beside
it, wired to it, and renders the chain; on an `effects` node it replaces the stack (or re-renders
it when `effects` is omitted). `make_effects_pair` turns a `shape-cutout` node into an A/B pair:
the twin has the same shapes and seed, the other side. All free.

Custom effects: `write_effect` writes a GLSL shader effect for the whole workspace (name, frag, params)
and returns its check; `patch_effect` edits it by find/replace at its `version`. `list_effects` shows
them under `custom`, each with the `step` to put in an `apply_effects` stack. On motion clips, ask
`ask_motion_agent` to add it.

The canvas and motion agents browse the web themselves (`web_search`, `read_page`, `read_store`, `view_images`, `screenshot_page`, `import_image`, `import_products`), so a request to `ask_motion_agent` can say "find X's brand colours". As an external agent, browse with your own web tools; feega does not proxy search.

Custom composition layouts: `write_layout` writes a spec layout (placement, slots, animation) for the
workspace, `patch_layout` replaces its spec at a `version`, `list_layouts` lists them; ask
`ask_motion_agent` to arrange a composition on one.

## Loop a node over many combinations

`run_node_loop` queues every combination from a node's `iterate` wires (or a plain "repeat N")
through the same engine as `run_node_generation` — one real run per combination. It returns as
soon as the queue is written, not when the results exist: a background tick drains it over the
following minutes, and results land in an output `list` node next to this one — poll that with
`query`. Above 50 combinations it comes back `needs_confirmation` with the count and cost; call
again with `confirm: true`. Above 1000 it is refused outright and the loop must be split. Credits
for the whole loop are checked up front. `preview_node_loop` reads how many combinations would
queue and what they would cost, without spending anything — call it first when the count is not
already known. `cancel_node_loop` stops what is still queued; anything a tick already claimed
finishes regardless, and what it already produced stays in the output list.

## Edit a motion video

A `motion` node is a video built in the motion editor. `list_motion_videos` finds them (optionally
per project) with their `node_id`, revision and poster. `get_motion_summary` reads one — revision,
duration, every track and clip in seconds. `ask_motion_agent` asks the editor's own AI to change
it in plain words ("make the title red and add a bounce"): one turn of the same agent the editor
chat runs, a new revision, the exchange visible in the editor chat. It returns at once with a
running `run_id`: poll `get_motion_run` every few seconds until `done` (reply, summary, new
`version`); `wait: true` polls for you up to about 4 minutes of a turn that can run up to 30. Spends credits. `attachments` (up to 10, 20 MB each): images the agent sees and can place
(e.g. a logo) and PDF/DOCX/PPTX/XLSX/CSV/TXT/MD/HTML it reads as text — each a public `url`, a
project `asset_id`, or base64 `data` + `name` + `mime_type`. CLI: `feega motion ask <nodeId> "<prompt>"
--attach ./brief.pdf https://…/logo.png asset:<id>`.

Render one with `render_video`: by default it is FREE and returns a `render_url`,
a one-time link (30 minutes, bound to the saved revision) the user opens on any device — the video
renders in their browser and lands in the project assets. Show the link; never open it yourself.
`mode: "server"` (our machines) is not available yet and is refused. `get_render` gives
the status and, when done, a signed `file_url`. CLI: `feega motion render <nodeId>`.

Put one on a website with `publish_motion_embed`: free, it hosts the interactive web export of
the saved revision and returns a public `url` and a two-line `snippet` — feega's loader script
and `<feega-motion src="id">` (or `<div data-feega="id">` where builders strip unknown tags).
It fills 100% of the box the site gives it (`fit="contain"` to show it all); with no height
it takes the video ratio, or a viewport for scrub. Scrub builds its own sticky scroll story of
the video's scroll length. Live components (games, generative pieces) run live there; a video
shows a still of them. Publishing again updates it in place, `action: "unpublish"` takes it
down. Uncensored projects are refused.
`get_motion_embed` reads the state. The self-contained HTML (no hosting):
`feega motion embed <nodeId> --download page.html`.

See a video with `view_motion_frames` (up to 6 times in seconds): the frames come back as
images with the quality gate's `quality` and `blocking` notes. Free; look before and after
`ask_motion_agent`. CLI: `feega motion frames <nodeId> --at 1,2.5,4`.

Every save is a revision. `list_motion_revisions` lists them (who saved, clip count);
`restore_motion_revision` puts one back as a new revision, history kept. Free. CLI:
`feega motion revisions <nodeId> [--restore <version>]`.

A launch film's script is also laid out as a storyboard canvas linked to the video: one card per
beat, story order left to right, stronger emotion higher. `get_storyboard` reads it (the user's
edits included, and the clips each card plays), `write_storyboard` writes it from beats,
`edit_storyboard_card` rewrites one card. Free. CLI: `feega motion storyboard <nodeId>
[--write beats.json | --card <id> --text "..."]`.

Sound design under the music: `write_motion_sound` writes a score of synth voices (whoosh, hit,
riser, click, pad, sub, tone) and timed events, rendered offline to one audio track that plays the
same in preview and export. Free. CLI: `feega motion sound <nodeId> score.json`.

## Remix from the gallery

The public gallery holds free motion videos and compositions anyone can remix, many by Feega.
`search_gallery` finds them by title words, `kind`, `format`, `duration` (short, medium, long) or
`tag`. `remix_gallery_item` copies one into a project as a new `motion` node with its texts,
colours, logo and media exposed as fields; then offer to put the user's brand on it with
`ask_motion_agent`. `publish_to_gallery` shares a `motion` node, only when the user asks: it is
refused for uncensored projects, real brands (their logo, a real-brand script, logos or pictures
imported from a website) and content the moderation refuses. Free. CLI: `feega gallery [query]`,
`feega gallery remix <itemId> --project <id>`, `feega gallery publish <nodeId> --title "…"`.

## Ad campaigns

Meta only (Facebook + Instagram). `list_ad_campaigns` reads a brand's campaigns and their status.
`create_ad_campaign` drafts one against a brand's Meta ad account — objective, budget, days,
audience, placements, copy, and canvas image/video nodes (or an existing post to boost) — and it
always lands `draft` with no `approved_by`: nothing here can make it spend. `approve_ad_campaign`
is the only door that launches it, and it only opens for a signed-in person's own session.
`set_ad_campaign_status` pauses or resumes a launched campaign.

## References (load on demand)

- [references/mcp.md](references/mcp.md) — connect MCP (stdio / HTTP), Cursor config, auth
- [references/tools.md](references/tools.md) — full MCP tool catalog + CLI equivalents
- [references/cli.md](references/cli.md) — install CLI and common commands

## Install this skill

```bash
npx skills add andreabuttarelli/feega --skill feega
```

Or install the marketplace plugin (skill + remote MCP):

```bash
# Claude Code
/plugin marketplace add andreabuttarelli/feega
/plugin install feega@feega

# Codex
codex plugin marketplace add andreabuttarelli/feega
```

Or copy this folder into `.cursor/skills/feega/` / `~/.claude/skills/feega/`.  
Submit / packaging details: [`docs/plugins.md`](../../../../docs/plugins.md).
