# Motion templates (.mogrt-style)

**Why.** Motion users wanted fixed designs they customise only with values and media, like
After Effects .mogrt files. #126 exposed fields on root clips only; precomps (#127) could not be
reused across videos.

**What.**
- `template/library.ts`: a template is a self-contained `MotionDoc` with exposed fields.
  `insertTemplate` copies it (ids prefixed, nested comps remapped) into a fresh comp behind a
  Precomp clip; the comp carries `template: { id, name, keys }`, which locks it. `keys` maps the
  template's field keys to the doc's (`headline`, `headline_2`, …), so CSV batch rows reach each
  instance with no new code path. `detachTemplate` drops the mark.
- Fields are found inside comps (`locateClip`, `setDeepProps`); `mergeView` keeps fields exposed
  while editing a precomp. New field types `select` and `media_list`; numbers carry
  `min/max/unit`, media slots `aspect`.
- Image/Video gain `focusX/focusY` (object-position): the crop of a media slot.
- `template/builtins.ts`: every composition-node layout plus six designs, built with `assemble`.
- Storage: `motion_templates` (org_id, RLS `auth_org_ids`), migration
  `supabase/canvas-migrations/20261005_motion_templates.sql`. Built-ins live in code, not rows.
- UI: Add → Browse templates (live preview, insert at playhead, save precomp/video, delete);
  `TemplateInspector` replaces the inspector for a locked Precomp; entering a locked comp is
  refused.
- Agent: `list_templates`, `insert_template`, `set_template_fields`, `detach_template`,
  `save_template`; `edit_comp` refuses a locked comp.

**Discarded.** Storing templates as nodes or assets: both are project-scoped, templates are
per org. A stored thumbnail: the picker renders the template live, `poster_frame` is kept for
later.

**Open.** The migration was not applied (the agent was denied the production DDL);
`database.types.ts` entries were written by hand in the generated format. Apply it, then
`npm run db:types` and `node scripts/schema-drift-check.mjs`.
