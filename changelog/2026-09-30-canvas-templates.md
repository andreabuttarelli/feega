# Canvas templates

**Why.** A blank canvas asks the user to know which nodes exist, which ports
connect and which model to pick. Templates hand over working workflows.

**What changed.**
- `src/lib/canvas/templates.ts`: 11 templates as data (nodes by `key`,
  `col`/`row`, `data`; edges `from`/`to` with target `handle`), plus
  `planTemplate` (pure, centred on a point, indices instead of ids).
- `templates.test.ts` keeps the registry honest: every `data` passes
  `validateNewNodeData`, every model is in the static catalogue (image,
  video, ElevenLabs, default text), every edge goes from a real output to a
  handle the target accepts.
- Wiring: Templates button in `CanvasAddBar.svelte` → `CanvasTemplateGallery`
  → `CanvasFlow` `onTemplate(id, viewCentre)` → `+page.svelte`
  `insertTemplate` → action `template` → `insertTemplate`
  (`server/canvas/templates.ts`) → `writePlan` (extracted from
  `duplicateNodes`) → `nodes` / `nodes_connections`. The server reads the
  template by id; the client never sends payloads. Undo covers the group.
- Seed inputs (idea, topic, title, brand) are `doc` nodes: free, editable,
  output `text`.
- `tests/e2e/canvas-templates.spec.ts` (@real): inserts every template, and
  generates one text node downstream of a template doc.

**Discarded.** Wiro models (synced at runtime, not checkable statically);
templates on `ads` / `social_post_mockup` (no output port); feed and store
templates (need a handle or a store URL to run). No MCP tool: nodes are
created there via generic `insert_row`, there is no create-node tool to
extend.
