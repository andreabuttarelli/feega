# I tool MCP di feega

> Generato da `node scripts/mcp-inventory.mjs --write`, leggendo `tools/list` dal server vero.
> Non si modifica a mano: il prossimo che rigenera cancella le correzioni.

**19 tool** — 6 in lettura, 10 in scrittura, 3 che distruggono.
Il payload di `tools/list` pesa **20.162 caratteri**, circa **5041 token**, ed e' il costo che ogni sessione paga prima di dire una parola.

| gruppo | tool |
|---|---:|
| Accesso diretto al database | 5 |
| Ads | 4 |
| Nodi e generazione | 4 |
| Altro | 3 |
| Post | 3 |

Legenda: **R** legge e non cambia niente · **W** scrive · **D** distrugge, e il client puo' chiedere conferma.

## Accesso diretto al database

### `delete_row` · D

*Delete rows*

Remove rows that exist, in your org. `where` is required — a delete with no filter is refused. At most 10 rows per call, counted before anything is removed. This does not come back. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. Omit to use the default. |
| `table` | string |  |
| `where` | object[] |  |

### `describe_node_types` · R

*Node data shapes*

What `data` must look like on a `nodes` row, per `type` — the JSON Schema `insert_row`/`update_row` actually enforce on `nodes`, not a guess. Omit `type` for every type at once; name one to save tokens once you know which you need — an unknown `type` comes back as an error naming the ones that exist, so this list is never hand-maintained here. `list` holds N iteration values (images or text, never mixed); `select` picks exactly one item back out of a connected `list`, `products` or `social_account_feed` by a 1-based `index` — a synced catalogue or feed is an ordered list too, so `select` can pull one product or one post out of either the same way; `effects` holds a stack of image filters over an upstream image, each with its own params — set it with `update_row`, then render it with `apply_effects`. Also returns `recommended_models` per medium (best, balanced, cheapest-good, each with price and release month) — prefer these over older models. Limits (aspect ratios, durations, prompt length) are NOT here — those come from `get_media_models`, because they are a fact of the model, not the node. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. Omit to use the default. |
| `type`? | string |  |

### `insert_row` · W

*Insert a row*

Add ONE row to any table in your org. `org_id` is filled in for you; naming a different one is refused, not quietly corrected. Never replaces anything — a row that already exists comes back as a collision, and changing it is `update_row`. Several jsonb columns are checked against a real shape before writing (`nodes.data` by `type` — call `describe_node_types` first; `posts.media`, `ad_campaigns.targeting`/`placements`, `canvases.viewport` too); a rejection names the exact field. Others are deliberately free-form. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. Omit to use the default. |
| `table` | string |  |
| `values` | object |  |

### `query` · R

*Query the database*

READ ANYTHING in your org: projects, canvases, nodes, connections, assets, posts, ads, products, social accounts — every table, scoped to your org and nothing else. No SQL: name a table, columns and filters, and it issues one PostgREST read. Omit `table` to list every name. A project has no brand until one is attached (`projects.brand_id` is nullable, and that is the normal case). A canvas belongs to a project; nodes and their connections belong to a canvas. A post (`posts` table) is the promoted artifact — caption, media, brand — different from a node, which is raw canvas material; `post_sources` links a post back to the nodes it came from. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. Omit to use the default. |
| `table`? | string |  |
| `columns`? | string[] |  |
| `where`? | object[] |  |
| `order`? | object \| array |  |
| `embed`? | object[] |  |
| `offset`? | integer |  |
| `count`? | `estimated` \| `exact` |  |
| `limit`? | integer |  |

### `update_row` · D

*Update rows*

Change columns on rows that already exist in your org. Only the columns you send are touched. `where` is required — an update with no filter is refused. At most 50 rows per call, counted before anything is written. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. Omit to use the default. |
| `table` | string |  |
| `where` | object[] |  |
| `values` | object |  |

## Ads

### `approve_ad_campaign` · D

*Approve an ad campaign*

Approve a proposed campaign and launch it on Meta — this spends money. REFUSED over an API key on purpose: an agent cannot approve its own spend — this only works from a signed-in person's own session (the app, or `feega login`). If you are an agent and this fails, tell the person to approve it themselves.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `id` | string |  |

### `create_ad_campaign` · W

*Propose a Meta ad*

Draft a paid Meta ad campaign (Facebook + Instagram) for a brand, from canvas image/video nodes or by boosting a published post. It ALWAYS lands as an unapproved draft: nothing is launched or billed until a person approves it in the app (or `feega ads --approve`). Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `brand_id` | string |  |
| `ad_account_id` | string | A Meta ad account of the brand (ad_accounts.id). |
| `objective` | `traffic` \| `engagement` \| `awareness` |  |
| `budget_type` | `daily` \| `lifetime` |  |
| `budget_amount` | number | Whole currency units of the ad account. |
| `days` | integer |  |
| `countries` | string[] |  |
| `age_min`? | integer |  |
| `age_max`? | integer |  |
| `gender`? | `all` \| `female` \| `male` |  |
| `placements` | string[] |  |
| `primary_text` | string |  |
| `headline` | string |  |
| `call_to_action`? | `LEARN_MORE` \| `SHOP_NOW` \| `SIGN_UP` \| `BOOK_NOW` \| `CONTACT_US` \| `ORDER_NOW` |  |
| `link_url`? | string | Required for traffic. |
| `node_ids`? | string[] | Canvas image/video nodes, in order. |
| `post_id`? | string | A published post to boost instead of node_ids. |

### `list_ad_campaigns` · R

*List ad campaigns*

Ad campaigns of one brand, with their status and whether a human has approved them yet. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `brand_id` | string |  |
| `status`? | `draft` \| `pending_review` \| `scheduled` \| `active` \| `paused` \| `completed` \| `failed` \| `rejected` |  |

### `set_ad_campaign_status` · W

*Pause or resume an ad campaign*

Pause a running Meta campaign, or resume a paused one. Pausing stops spend.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `id` | string |  |
| `next` | `active` \| `paused` |  |

## Nodi e generazione

### `cancel_node_loop` · W

*Cancel a queued loop*

Stops the combinations still queued for this node — the ones a tick has already claimed finish regardless, and anything already produced stays in the output list. Returns how many combinations it actually stopped.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |

### `preview_node_loop` · R

*Preview a node's loop*

How many combinations `run_node_loop` would queue on this node right now, and what they would cost — reads only, spends nothing. Call this before `run_node_loop` when the count is not already known, rather than guessing at whether confirm will be needed.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |

### `run_node_generation` · W

*Generate a node's content*

Generate into an existing canvas node — text, image or video. This is the same engine the canvas Generate button calls; it never creates a node (`insert_row` does that). `medium` MUST match the node's own type, or the call is refused before anything is spent. Pass `version` as the node's current `nodes.version`: a stale value comes back `conflict` (never a silent overwrite) — re-read the node and retry with the fresh version. A `video` NEVER returns finished here: it comes back `queued` with an `external_job_id` on the run, and the render lands later, asynchronously — the node stays `running` until a later tick deposits the asset. Poll the node (`query`) rather than expecting a file now. A finished result returns `asset_ids` and `media` with `preview_url`/`full_url` (see `get_media`). Omit `model` to keep the node's own model, or the recommended balanced one for the medium when it has none (`describe_node_types` lists the recommended ones). A model the canvas does not offer is refused with the recommended alternatives; an old or weak one still runs but the result carries a `warning` naming the recommended one. Spends credits; a `credits_exhausted` failure means the org is out.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `medium` | `text` \| `image` \| `video` |  |
| `prompt` | string |  |
| `model`? | string |  |
| `version` | integer |  |
| `params`? | object |  |

### `run_node_loop` · W

*Queue a generation node loop*

QUEUES many combinations from a node's `iterate` wires (or plain "repeat N" variants when it has none) to run through the SAME engine `run_node_generation` calls — one real run per combination, never a copy of it. This call returns as soon as the queue is written, NOT when the images exist: combinations run a few at a time as a background tick drains the queue over the following minutes, so 1000 combinations take longer than 50 to finish. Up to 50 queues on the call; above 50 it comes back `needs_confirmation` with the count and the credit cost — call again with `confirm: true`; above 1000 it is refused outright and the loop must be split. Credits for the WHOLE loop are checked up front, not discovered empty halfway. A failed combination never stops the others; results land in an output `list` node next to this one as they finish, each item labelled with which values produced it — poll that node (`query`) to see progress, do not expect it done here.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `confirm`? | boolean | Required (true) to queue above 50 combinations. |

## Altro

### `apply_effects` · W

*Render an effects node*

Renders an `effects` node's stack onto its upstream image and lands the result as the node's `refId` — the same render `EffectsEditor` does in the browser, run server-side so an agent without a browser can do it. Set the stack first with `update_row` on `nodes.data.effects` (see `describe_node_types` for the effect list and their params), then call this. Refused before anything runs if `data.sourceRefId` is empty (nothing upstream to render) — wire an image into the node first. Spends no credits: no AI provider is called.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |

### `enhance_prompt` · W

*Rewrite a prompt for the model that will render it*

Rewrites a brief into the SHAPE the model you are about to render with wants — one reads labelled sections, another one flowing paragraph, another a command when it edits. Pass the `model` (`get_media_models` lists them) and use the `prompt` that comes back to render. It rewrites, it never invents: a rewrite that adds a subject, asks for readable text or states an aspect ratio is thrown away and the original returns with `changed: false` and the reason in `notes`, as does a model we have no guide for. Draws nothing, files nothing. Spends credits.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `prompt` | string |  |
| `model` | string |  |
| `shot_mode`? | `hero` \| `flat-lay` \| `on-model` \| `close-up` \| `lifestyle` \| `studio` |  |

### `get_media` · R

*See a node's media*

View the image, video or text a node holds, a generation run produced, or an asset — by `node_ids`, `run_ids` and/or `asset_ids`. Per item: type, mime, width/height, duration, and two signed links: `preview_url` (images: 1024px long edge, valid 5 minutes — FETCH THIS to look at the image and judge it against the prompt) and `full_url` (the original file, valid 1 hour — give this to the user). Videos have `full_url` only. Ids your org cannot see come back in `missing`. Reads only, spends nothing.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_ids`? | string[] |  |
| `run_ids`? | string[] |  |
| `asset_ids`? | string[] |  |

## Post

### `create_post` · W

*Promote to a post*

Turn material into a post: this is what makes something publishable, distinct from writing to a node. Two ways in: give it a brand, a caption and its media (asset ids already in this org) directly — or give it `node_ids` and let it resolve each node to its asset itself (uploaded or generated), ordered by canvas reading order (top-to-bottom, left-to-right), with text/doc nodes becoming the caption. `sources` optionally links back to the nodes it came from when using the direct form. Lands as `draft`; nothing is scheduled or published from here. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `brand_id` | string |  |
| `caption`? | string |  |
| `media`? | object[] |  |
| `title`? | string |  |
| `link_url`? | string |  |
| `sources`? | object[] |  |
| `node_ids`? | string[] | Resolve these canvas nodes into the post instead of passing caption/media directly. |
| `planned_for`? | string | ISO date-time the draft is planned for. It shows on calendars; nothing is scheduled. |

### `list_posts` · R

*List posts*

Posts of one brand — the promoted artifacts, not canvas nodes. Filter by status (draft, ready, archived). Each carries plannedFor, the day a draft is planned for. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `brand_id` | string |  |
| `status`? | `draft` \| `ready` \| `archived` |  |

### `set_post_status` · W

*Change a post status*

Move a post between draft, ready and archived. Does not schedule or publish it. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `id` | string |  |
| `status` | `draft` \| `ready` \| `archived` |  |

