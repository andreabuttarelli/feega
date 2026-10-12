# Component library: browse in the editor, start a video from one

## Why

Built-in templates (prompt input, UI morph, scenes, media layouts) were reachable only from the
editor's text-list template dialog, and a component could only go into a video already open.
The user asked for a real library in Add, the same components on the dashboard, and a way to
start a new project video from one.

## What

- `src/lib/motion/template/catalogue.ts`: the read model for the library. `componentKind`
  sorts a template by its clips (any `Custom` → component, only `Composition` → media layout,
  else scene); `catalogue` lists whatever `BUILTIN_TEMPLATES` registers, components first;
  `starterDoc` builds the first doc of a new video (template at frame 0, its length and fps,
  chosen format). New built-ins (floating-media) appear without touching this file.
- `src/lib/server/motion/from-template.ts`: `startFromTemplate` reuses `startMotion`, then
  writes revision 1 with `saveMotionDoc` (expected version 0). `videoFromTemplate` is the API
  adapter (project defaults to the most recent).
- Wiring: `ComponentShelf.svelte` on `/app` → `?/fromTemplate` in `src/routes/app/+page.server.ts`
  → `startFromTemplate` → `nodes` + `motion_revisions` → redirect to the editor.
  Editor: Add → Browse components (`ComponentLibrary.svelte`) → existing `insertEntry`.
  API `POST /api/v1/motion/from-template`, CLI `feega motion new --template`, MCP
  `new_motion_from_template`.
- Previews: `scripts/component-previews.ts` renders each built-in once (48 frames, 480px,
  12 fps mp4 + jpg poster) into `static/component-previews/` and lists them in `previews.json`;
  media layouts reuse `static/compose-templates/`. Cards show the poster and play the clip on
  hover, or when in view on touch screens. A test fails if a listed preview file is missing.
  Run: dev server on a free port, then
  `PUBLIC_APP_URL=http://localhost:<port> CHROMIUM_PATH=<headless shell> npx vite-node --config scripts/vite-node.config.ts scripts/component-previews.ts [ids...]`.

## Decisions

- The menu item "Prompt input…" is replaced by "Browse components…": the library holds it.
- Template sounds are not laid when starting a new video (they need the SFX pipeline); insert
  from the editor keeps the sounds option.
- Not added to the gallery: gallery items are published videos with `remixed_from`; a
  component is not a gallery item, and the dashboard row already covers remixing it.
- Discarded: rendering previews live in iframes on every view (heavy on the dashboard).
