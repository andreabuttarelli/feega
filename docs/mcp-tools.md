# I tool MCP di feega

> Generato da `node scripts/mcp-inventory.mjs --write`, leggendo `tools/list` dal server vero.
> Non si modifica a mano: il prossimo che rigenera cancella le correzioni.

**50 tool** — 19 in lettura, 25 in scrittura, 6 che distruggono.
Il payload di `tools/list` pesa **49.305 caratteri**, circa **12.326 token**, ed e' il costo che ogni sessione paga prima di dire una parola.

| gruppo | tool |
|---|---:|
| Altro | 19 |
| Video motion | 15 |
| Accesso diretto al database | 5 |
| Ads | 4 |
| Nodi e generazione | 4 |
| Galleria e remix | 3 |

Legenda: **R** legge e non cambia niente · **W** scrive · **D** distrugge, e il client puo' chiedere conferma.

## Altro

### `apply_effects` · W

*Apply image effects*

Applies one effect or a chain (`list_effects`) and lands the result as a new asset — the same render the canvas Effects editor does. On an image node it creates an `effects` node beside it, wired to it; on an `effects` node it replaces the stack with `effects` when given, otherwise re-renders the stack it has. `effects`: `[{ id, params?, enabled? }]` in order, missing params take their defaults. Returns `{ node_id, asset_id }`. Spends no credits: no AI provider is called.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `effects`? | object[] |  |

### `canvas_tool` · D

*Work a project canvas*

The canvas ops of the project chat, on one project (`project_id`), with `input` in camelCase. Reads: list_canvases {}, estimate_text_cost {canvasId,nodeId,prompt?,model?} (token estimate of a text run), suggest_next_steps {canvasId,nodeId}, list_nodes {canvasId}, canvas_snapshot {canvasId} (nodes, connections, runs, products, socialPosts, influencers, revision), canvas_revision {canvasId} (live revision, or canvas/project gone), list_runs {nodeId}, preview_node_loop {nodeId}, preview_run_graph {graph:"downstream",nodeId} | {graph:"stale",canvasId,nodeIds?} (ordered steps + credits: quote before run_graph). Writes, free: create_node {canvasId,type,x,y,displayName?,data?} (data per describe_node_types), update_node {nodeId,data} (only changed fields, null removes), move_node {nodeId,x,y,z?}, resize_node {nodeId,width,height}, connect_nodes {canvasId,sourceNodeId,targetNodeId,sourceHandle?,targetHandle?}, delete_node {nodeId} (soft, drops its lines), cancel_node_loop {nodeId}, duplicate_nodes {canvasId,nodeIds}, write_nodes {canvasId,items:[{node_id,version,patch}]} (merge each patch, per-node written|conflict|not_found), paste_nodes {canvasId,nodes:[{type,data,x,y}],edges?:[{sourceIndex,targetIndex,sourceHandle?,targetHandle?}]}, list_connections {canvasId}, disconnect_nodes {connectionId}, set_edge_mode {connectionId,mode:fixed|iterate}, undo_gesture {canvasId,items} (replay a recorded gesture inverse; refused when the canvas moved on), run_demo {canvasId} (first-run example chain), end_onboarding {status:dismissed|completed}, create_canvas {}, rename_canvas {canvasId,name}, delete_canvas {canvasId}, rename_project {name}, share_canvas {canvasId,on} (view-only link), share_doc {nodeId,on}, list_templates {}, insert_template {canvasId,templateId,x,y}, add_frame_from_template {canvasId,templateId,format?,x,y}, move_frame_element {frameId,elementId,toFrameId?,x?,y?,canvasX?,canvasY?}, place_in_frame {nodeId,toFrameId?,x?,y?}, show_run {nodeId,runId} (show an older result), sync_node {nodeId} (products, social feed), preview_workflow {canvasId,nodeIds}, cancel_workflow {workflowId}, cancel_render {nodeId}, withdraw_from_gallery {itemId}. Upload a file into a new node: request_upload {fileName,mimeType,bytes} (checked like the canvas upload: image/document 4MB, video 200MB) answers path + uploadUrl; PUT the bytes there with the Content-Type, then register_upload {canvasId,path,fileName,mimeType,bytes,x?,y?} answers node + asset. Custom voices: list_voices {}, voice_library {search?,language?,gender?,accent?,useCase?,page?}, use_library_voice {ownerId,voiceId,name}, save_voice {generatedVoiceId,name,description?}, delete_voice {id}. Spends credits: run_node {nodeId,medium,prompt?,model?,params?,expectedVersion}, run_node_loop {nodeId,confirm?}, retry_loop_combination {nodeId,outputListNodeId,label,runId?}, run_workflow {canvasId,nodeIds}, run_graph (same input as preview_run_graph; queued, each step after its inputs; cycles refused), design_voice {description} (previews to save_voice), clone_voice {name,consentBasis:own_voice|consented_speaker,speaker?,attested:true,seconds:60-180,sampleBase64 (max 3MB),mimeType?} (only with the user's consent). Unknown op answers the list; bad input answers the issues.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `project_id` | string |  |
| `op` | string |  |
| `input`? | object |  |

### `edit_storyboard_card` · W

*Rewrite a storyboard card*

Replace the text of one card of a motion video storyboard (`card_id` from `get_storyboard`).

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `card_id` | string |  |
| `text` | string |  |

### `enhance_prompt` · W

*Rewrite a prompt for the model that will render it*

Rewrites a brief into the SHAPE the model you are about to render with wants — one reads labelled sections, another one flowing paragraph, another a command when it edits. Pass the `model` (`get_media_models` lists them) and use the `prompt` that comes back to render. It rewrites, it never invents: a rewrite that adds a subject, asks for readable text or states an aspect ratio is thrown away and the original returns with `changed: false` and the reason in `notes`, as does a model we have no guide for. Draws nothing, files nothing. Spends credits.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `prompt` | string |  |
| `model` | string |  |
| `shot_mode`? | `hero` \| `flat-lay` \| `on-model` \| `close-up` \| `lifestyle` \| `studio` |  |

### `forget_app_account` · D

*Forget the test app account*

Deletes the test account and the browser session the project remembers; the chat asks for a test account again. Spends nothing.

| campo | tipo | |
|---|---|---|
| `project_id` | string | The project id. |

### `get_app_account` · R

*Show the test app account*

The TEST account of the user's own app that the project chat remembers to log in and photograph its screens: login url, email, session expiry. Never the password. Reads only, spends nothing.

| campo | tipo | |
|---|---|---|
| `project_id` | string | The project id. |

### `get_media` · R

*See a node's media*

View the image, video, audio, 3D model or text a node holds, a generation run produced, or an asset — by `node_ids`, `run_ids` and/or `asset_ids`. Per item: type, mime, width/height, duration, and two signed links: `preview_url` (images: 1024px long edge, valid 5 minutes — FETCH THIS to look at the image and judge it against the prompt) and `full_url` (the original file, valid 1 hour — give this to the user). Videos and audio have `full_url` only. Ids your org cannot see come back in `missing`. Reads only, spends nothing.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_ids`? | string[] |  |
| `run_ids`? | string[] |  |
| `asset_ids`? | string[] |  |

### `get_render` · R

*Read a render*

State of a `render_video` run: `status` (running, done, failed, expired), `mode`, and when done `asset_id` and a signed `file_url` valid one hour. Reads only.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `run_id` | string |  |

### `get_storyboard` · R

*Read the storyboard of a frame*

The storyboard canvas linked to a motion video: its cards left to right (`node_id`, `text`, the `clip_ids` that play it), the pictures and clips on it with their asset ids and the card each feeds, and the card-to-card `flow`. `storyboard: null` when none was written. Reads only.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |

### `list_effects` · R

*List image effects*

Every image effect `apply_effects` accepts, with its params (range, options, default), and the workspace's custom effects (`write_effect`) as `custom: [{ effect_id, name, version, state, step }]`: put `step` (`{ id: "custom", ref }`) in an `apply_effects` stack. Reads only, spends nothing.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |

### `list_layouts` · R

*List custom layouts*

The workspace's custom composition layouts: id, name, version, spec. Reads only, spends nothing.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |

### `list_shader_effects` · R

*List shader effects*

The GPU shader effects (open-source shaders library, WebGPU) the motion agent adds with `add_shader_effect`: gradients, noise, glass, metal, light, distortions, wipes, blurs. Each with category, `source` (generator, or filter over a picture), `live` (cursor effects: interactive embeds only), its knobs with ranges and whether they take keyframes, and colours. Name one in `ask_motion_agent`, e.g. "add an iris-wipe reveal on the product shot". Reads only.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |

### `make_effects_pair` · W

*Make a shape cutout A/B pair*

For an `effects` node with a `shape-cutout` step: creates its twin (same shapes and seed, other side — shapes over the image vs fill with holes), wired to the same image, and renders it. Returns `{ node_id, asset_id }`. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |

### `patch_effect` · W

*Patch a custom effect*

Edits a custom effect: `edits` `[{ find, replace }]` applied in order on its frag, `params` replaces the list. `version` is the one `list_effects` or `write_effect` returned; a stale one answers 409 conflict. Returns `{ effect }` with the new check. Spends no credits.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `effect_id` | string |  |
| `version` | integer |  |
| `edits`? | object[] |  |
| `params`? | object[] |  |

### `patch_layout` · W

*Patch a custom layout*

Replaces the spec of a custom layout at its `version` (`list_layouts`); a stale one is a 409. Spends no credits.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `layout_id` | string |  |
| `version` | integer |  |
| `spec` | object |  |

### `render_video` · W

*Render a frame*

Render the saved revision of a motion video to MP4. Default `mode: "browser"`: free, returns a `render_url` — a one-time link (expires in 30 minutes, bound to this revision) the user opens on any device; it renders in their browser and saves the file to the project. Show the link to the user. `mode: "server"` renders on the farm, the same path and credit gate as the editor Render button; while server rendering is closed for everyone it answers 403 `server_render_unavailable`. A live component (a game or generative piece) cannot be seeked: the video shows a still of it; publish it as an embed instead. Poll `get_render` with the `run_id` for the file.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `mode`? | `browser` \| `server` |  |
| `resolution`? | `720p` \| `1080p` \| `1440p` \| `2160p` |  |
| `format`? | string | server only: mp4-h264, mp4-h265, prores-422hq, prores-4444, webm-alpha, png-sequence, gif |
| `quality`? | `standard` \| `high` \| `max` |  |
| `fps`? | number \| number \| number \| number \| number |  |

### `write_effect` · W

*Write a custom effect*

Writes a custom shader effect for the whole workspace (same name replaces it): `frag` is a GLSL ES 1.0 body defining `vec4 effect(vec2 uv)`, with `u_src` (the picture), `u_res`, `u_time`, `u_seed`, `v_uv`, `hash(vec2)` and `noise(vec2)` given, and each param a uniform `u_<key>` (number → float, color → vec3, seed → float; keys src, res, time, seed are taken). No #extension, no derivatives, loops bounded at 64, at most 16 texture2D, 12 KB. Returns `{ effect }` with its check (passed, failed + problems, unchecked). Spends no credits.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `name` | string | kebab-case, e.g. vhs-glow |
| `frag` | string |  |
| `params`? | object[] |  |

### `write_layout` · W

*Write a custom layout*

Writes a custom composition layout for the workspace (same name replaces it). `spec`: `{ kind: "spec", slots, place, cards?, camera?: fixed|selected, motion?: cycle|ping-pong|linear, params?, tilt?, scale?, animate? }`; `place` is `{ kind: "grid", columns, gapX, gapY }`, `{ kind: "ring", radius }`, `{ kind: "line", gap, axis }` or `{ kind: "scatter", spread, depth, seed }`; `animate` items `{ prop: x|y|z|rotX|rotY|rotZ|scale|opacity, fn: sin|linear|ease, amp, freq, phase: { column, row, index } }`; any number may be `{ param }` of a declared range param. Ask `ask_motion_agent` to put it on a composition. Spends no credits.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `name` | string | kebab-case |
| `spec` | object |  |

### `write_storyboard` · W

*Write the storyboard of a frame*

Lay out a motion video as a storyboard canvas: one card per beat, story order left to right, stronger emotion higher. Each beat: `act` (problem, solution, proof, claim), `kind` (title_card, ui_beat, product_shot, scene, logo), `title`, `intent`, `on_screen`, `emotion`, `intensity` 0-1, `duration` seconds, `visual`, `music`, `media` (project image/video asset ids), `branch_of` (index of an earlier beat it replaces). Replaces the cards written before; what the user added stays.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `beats` | object[] |  |

## Video motion

### `add_motion_template` · W

*Add a template to a frame*

Insert an editable copy of a template (id from `list_motion_templates`) at `at` seconds, its fields set from `vars` (keys and types as listed). `sound` (default true) lays its key taps and clicks on the SFX track. Saved as a new revision; no AI, free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `id` | string |  |
| `at`? | number |  |
| `vars`? | object |  |
| `sound`? | boolean |  |

### `ask_motion_agent` · W

*Ask the frame editor agent*

Edit a motion video (a `motion` canvas node) by asking the motion editor's own AI in plain words, e.g. "make the title red and add a bounce". It runs one turn of the same agent as the editor chat, with its own tools, writes a new revision of the video and posts the exchange in the editor chat. Find the node id with `list_motion_videos`; read the video first with `get_motion_summary` to name clips precisely. Returns at once with a `run_id` (`running`): poll `get_motion_run` every few seconds until `done`, which carries the reply, the summary and the new revision `version`. `wait: true` polls for you, up to about 4 minutes of a turn that can run up to 30. The agent looks at its own frames even with no editor open. Spends credits. `attachments` (up to 10): images (PNG, JPG, WebP, GIF) the agent sees and can place in the video, and PDF/DOCX/PPTX/XLSX/CSV/TXT/MD/HTML files it reads as text — each one a public `url`, an `asset_id` of the project, or inline base64 `data` with `name` and `mime_type`; at most 20 MB each. When the agent wants the user's taste it ends its turn with `reference_pick` in the run (question and candidate pictures with ids): show them to the user, then call again with `reference_pick: { follow: [ids], avoid: [ids], note }` (prompt optional), or `{ follow: [], avoid: [], rejected: true, query, avoid_all }` when none fit: the agent searches again. Followed pictures become the targets, avoided ones what not to do.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `prompt`? | string |  |
| `wait`? | boolean |  |
| `attachments`? | any[] |  |
| `reference_pick`? | object |  |

### `get_motion_embed` · R

*Read a frame web embed*

Whether the web embed of a motion video is `published`, its public `url`, the loader `snippet` and the saved `revision`. The self-contained HTML file (no hosting) is downloaded with `feega motion embed <node> --download <file>`, or GET `/api/v1/motion/{node_id}/embed/bundle`. Reads only.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |

### `get_motion_run` · R

*Read a frame agent run*

State of an `ask_motion_agent` run: `status` (running, done, failed, expired), the agent `reply`, the `summary` of its edits, the new revision `version` (null when nothing was saved), `cost_usd` and `editor_url`. Reads only.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `run_id` | string |  |

### `get_motion_summary` · R

*Read a frame*

The saved state of a motion video: revision `version`, last change and who made it, size, fps, duration and every track and clip with start/duration in seconds. Reads only, spends nothing.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |

### `list_motion_revisions` · R

*List the saved versions of a frame*

Every saved revision of a motion video, newest first: `version`, who saved it (`actorKind` user or agent), the `summary` of the change and how many `clips` it had, so a broken or emptied version can be told from a good one. Reads only.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |

### `list_motion_templates` · R

*List frame templates*

Ready-made pieces to drop into a motion video (built-in and saved by the org), e.g. builtin:prompt-input, a prompt field that types, presses send and thinks. Each with `id`, `seconds`, its `card` (roles such as opener/feature/proof/closer, energy, loops, onScreen beat by beat with seconds, edges start→end with a suggested transition, goodFor) and its `fields`: key, type (text, number min..max, color #rrggbb, boolean, select options), group and default. Plan a video as sections and pick one template per section by card. Reads only, free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |

### `list_motion_videos` · R

*List frames*

The motion videos (`motion` canvas nodes) of the org, newest first, optionally of one project: `node_id`, `name`, `project_id`, `canvas_id`, `format`, saved revision `version` (0 = empty), signed `poster_url` and `last_render_url` (one hour, null when none) and `editor_url`. Use it to find the `node_id` the other motion tools take. Reads only.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `project_id`? | string |  |

### `motion_budget` · W

*Read or raise the budget of a frame*

What a motion video has spent on AI across all its agent turns (`spent_usd`) and what it may spend (`cap_usd`). When an ask returns `video_budget`, the agent stopped because the video used its budget: its work is saved. `action: "raise"` adds `raise_usd` to the cap (only when the user asked to continue), then `ask_motion_agent` continues.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `action`? | `read` \| `raise` |  |

### `motion_editor_op` · D

*Run a frame editor action*

The actions the frame editor page runs on a `motion` node (`node_id`), same answers as the page, with `input` in camelCase. Reads: read_head {} (version, full doc, actorKind), render_status {} (latest server render), batch_status {} (latest batch render). Writes: save_doc {version,doc,summary?} (whole doc; 409 answers the head), apply_ops {version,ops,summary?} (doc ops, rebased on newer edits), record_export {path,width,height,seconds} (an mp4 already in storage becomes the render asset), upload_font {path} (a font file already in storage), analyze_sounds {assetIds} (tempo, beats, speech), template_sounds {doc,clipId} (lays the template clip SFX; answers the doc), save_template {doc,name,description,compId?,posterFrame?}. Spends credits: generate_sound {sound:voice|music,text,seconds?} (answers assetId, url), render_batch {version,rows:[{name,values}],settings?} (one server render per row of template field values; poll batch_status). Unknown op answers the list; bad input answers the issues; a stale `version` answers 409.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `op` | string |  |
| `input`? | object |  |

### `motion_tool` · W

*Run a frame editor tool*

Every tool of the motion editor agent (add_clip, set_props, set_keyframes, add_template, set_canvas, export_image... over 140), run directly on a video with no AI and no credits. No `tool`: lists them by name. `tool` alone: its description and JSON input schema. `tool` with `node_id`: runs it on the saved video with `input`; an edit is saved as a new revision (`version` answers the new one; pass the `version` you read to refuse a stale write with 409). Still graphics: `set_canvas` with `still` (seconds of the frame) and `format` "4:5" post, "9:16" story or "A poster"; `export_image` (`format` png, jpg, webp; `scale` 1 or 2) saves the image to the project and returns its `url`. Tools that need a chat turn (research, voice, sub-agents) answer with an error: use `ask_motion_agent` for those.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `tool`? | string |  |
| `node_id`? | string |  |
| `input`? | object |  |
| `version`? | integer |  |

### `new_motion_from_template` · W

*Start a frame from a template*

Create a new motion video that already holds a template (id from `list_motion_templates`) at 0s, sized to `format` (16:9 default; 9:16 story, 4:5 post, "A poster"), in `project` (default: the most recently active). `still`: seconds of the one frame to keep, making it a still graphic (post, poster) instead of a video. Returns node_id and editor_url; change its fields with `add_motion_template` vars or `ask_motion_agent`. No AI, free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `template` | string |  |
| `format`? | `16:9` \| `9:16` \| `1:1` \| `4:5` \| `1:1 1440` \| `A poster` |  |
| `project`? | string |  |
| `still`? | number |  |

### `publish_motion_embed` · W

*Publish a frame as a web embed*

Host the interactive web export of the saved revision on feega and return the public `url` and a `snippet` to paste into any site: feega's loader script and a `<feega-motion>` element that fills 100% of its box, reading playback and scroll length from feega (keeps pointer, tilt, scroll, key and tap input; live components such as games and generative pieces run live there). Publishing again updates the same embed in place, so the site needs no new paste. Also returns `react` and `flutter`: the same embed for a React app (`@feega/motion-react`) or a Flutter app (`feega_motion`), running the same player. `action: "unpublish"` takes it down. Videos from an uncensored project are refused (403, `refusal`). Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `action`? | `publish` \| `unpublish` |  |

### `restore_motion_revision` · W

*Restore a saved version of a frame*

Put an earlier revision of a motion video back (number from `list_motion_revisions`). It is saved as a NEW revision: no history is deleted, and restoring again undoes it. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `version` | integer |  |

### `view_motion_frames` · R

*See still images of a frame*

Draw the saved revision of a motion video at up to 6 exact times (seconds) and see them as JPEG images, with the quality gate the editor agent uses: `quality` lists every problem found (clipped or tiny text, flat or blank frames, flashes, missing music...), `blocking` the ones that must be fixed before delivery. `width` is the longest side in pixels (default and max 960). Use it to check a video before and after `ask_motion_agent`. Free; about 10 calls a minute per workspace.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `times` | number[] |  |
| `width`? | integer |  |

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

What `data` must look like on a `nodes` row, per `type` — the JSON Schema `insert_row`/`update_row` actually enforce on `nodes`, not a guess. Omit `type` for every type at once; name one to save tokens once you know which you need — an unknown `type` comes back as an error naming the ones that exist, so this list is never hand-maintained here. `list` holds N iteration values (images or text, never mixed); `select` picks exactly one item back out of a connected `list`, `products` or `social_account_feed` by a 1-based `index` — a synced catalogue or feed is an ordered list too, so `select` can pull one product or one post out of either the same way, exposing named outputs (`out:images`, `out:text`, and `out:field:<field>` for each entry of `data.outputs` — the fields per source are listed in its schema) that an edge picks with `source_handle`; `effects` holds a stack of image filters over an upstream image, each with its own params — set it with `update_row`, then render it with `apply_effects`; `audio` runs one ElevenLabs operation — `audio_operations` lists each one's inputs, default model and price. Also returns `recommended_models` per medium (best, balanced, cheapest-good, each with price and release month) — prefer these over older models. Limits (aspect ratios, durations, prompt length) are NOT here — those come from `get_media_models`, because they are a fact of the model, not the node. Free.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. Omit to use the default. |
| `type`? | string |  |

### `insert_row` · W

*Insert a row*

Add ONE row to any table in your org. `org_id` is filled in for you; naming a different one is refused, not quietly corrected. Never replaces anything — a row that already exists comes back as a collision, and changing it is `update_row`. Several jsonb columns are checked against a real shape before writing (`nodes.data` by `type` — call `describe_node_types` first; `posts.media`, `ad_campaigns.targeting`/`placements`, `canvases.viewport` too); a rejection names the exact field. On `nodes_connections`, an edge into a node whose model is uncensored is refused — those nodes take no input of any kind. Others are deliberately free-form. Free.

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

Generate into an existing canvas node — text, image, video, audio or model3d. This is the same engine the canvas Generate button calls; it never creates a node (`insert_row` does that). `medium` MUST match the node's own type, or the call is refused before anything is spent. Pass `version` as the node's current `nodes.version`: a stale value comes back `conflict` (never a silent overwrite) — re-read the node and retry with the fresh version. A `video` NEVER returns finished here: it comes back `queued` with an `external_job_id` on the run, and the render lands later, asynchronously — the node stays `running` until a later tick deposits the asset. Poll the node (`query`) rather than expecting a file now. An `audio` node runs one ElevenLabs operation set in `params.operation` (see `audio_operations` in `describe_node_types`); `describe_node_types` with `type: audio` also lists the voices. Audio `dubbing` is queued like a video. A `model3d` node turns ONE connected image into a GLB 3D model on a `wiro/` image-to-3D model. With no image but a prompt or connected text, it first draws a white-background product shot on the cheapest image model (billed too), then models that; with neither it is refused. Settings go in `params` (Trellis/Pixal3D `pipeline_type`, Hunyuan3D `generate_texture`). A finished result returns `asset_ids` and `media` with `preview_url`/`full_url` (see `get_media`). Omit `model` to keep the node's own model, or the recommended balanced one for the medium when it has none (`describe_node_types` lists the recommended ones). A model the canvas does not offer is refused with the recommended alternatives; an old or weak one still runs but the result carries a `warning` naming the recommended one. Models whose id starts with `wiro/` run on Wiro and are always queued like a video, after a safety screen that refuses with a readable reason. Uncensored `wiro/` models run only when the org owner turned them on in Settings; minors and real, identifiable people are refused regardless. An uncensored model takes NO input of any kind — no upstream connections, no picked references, no image/mask/init params — and the call is refused before anything is spent if any are present. Spends credits; a `credits_exhausted` failure means the org is out.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `medium` | `text` \| `image` \| `video` \| `audio` \| `model3d` |  |
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

## Galleria e remix

### `publish_to_gallery` · W

*Publish a video to the gallery*

Publish a `motion` node to the public gallery, free, so anyone can remix it. Only when the user asks. Refused for uncensored projects, real brands (their logo, a script about a real brand, logos or pictures imported from a website) and content the moderation refuses. `title` up to 80 characters, `description` up to 500, up to 8 one-word `tags`. Returns the gallery `id` and `url`.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `node_id` | string |  |
| `title` | string |  |
| `description`? | string |  |
| `tags`? | string[] |  |

### `remix_gallery_item` · W

*Remix a gallery item*

Remix a gallery item, free: copies its video and files into a new `motion` node of `project_id` (on `canvas_id`, or on the Motion canvas), with its main texts, colours, logo and media exposed as fields. Returns `node_id` and `editor_url`. Then offer to put the user brand on it with `ask_motion_agent`.

| campo | tipo | |
|---|---|---|
| `org`? | string | Which org, if you belong to more than one. |
| `item_id` | string |  |
| `project_id` | string |  |
| `canvas_id`? | string |  |

### `search_gallery` · R

*Search the remix gallery*

Search the public gallery of free motion videos and compositions anyone can remix (many by Feega). Filters: `query` (title words), `kind` (motion, composition), `format` (16:9, 9:16, 1:1, 4:5), `duration` (short up to 6 s, medium 6 to 15 s, long over 15 s), `tag`. Returns id, title, author, format, seconds, remixes and url. Free, reads only.

| campo | tipo | |
|---|---|---|
| `query`? | string |  |
| `kind`? | `motion` \| `composition` |  |
| `format`? | `16:9` \| `9:16` \| `1:1` \| `4:5` \| `1:1 1440` |  |
| `duration`? | `short` \| `medium` \| `long` |  |
| `tag`? | string |  |

