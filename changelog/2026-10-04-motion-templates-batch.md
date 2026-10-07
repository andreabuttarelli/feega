# Motion templates and data-driven batch

**What.** After Effects "Essential Graphics" + CSV for motion docs.

- `doc.fields` (`template/field-model.ts`): `{ key, label, type, clipId, prop, default }`. One model
  covers text, custom component params, colours and asset slots: they are all clip props. A field
  on a deleted clip is kept and reported `missing`, not dropped (a doc refine would have made
  deleting the clip fail).
- `template/fields.ts`: `exposeField`, `removeField`, `fieldValues`, `applyValues` (per-type
  coercion in one `COERCE` table; empty cell = default).
- `template/batch.ts`: CSV/TSV parser (quotes, CRLF, multi-line cells), column map, output name
  pattern (`{{n}}`, `{{field}}`), Google Sheets link → CSV export URL (fetched in the browser).
- Server: `startBatch` (render-run.ts) refuses the whole batch if any row would be refused, then
  enqueues one `node_runs` row per CSV row (job stored in storage) and launches
  `BATCH_CONCURRENCY` (3). The canvas runs tick launches queued rows as slots free; each row
  renders, retries and is billed exactly like a single render (PR "render out of the request").
- `startRender` was split into `refusal` / `enqueue` / `launch` first, in its own commit.
- UI: `TemplateDialog.svelte` (header button "Template"): fields table, expose a prop of the
  selected clip, paste/upload CSV or load a Sheet, map columns, preview row N in the player, quote
  total, render, progress grid, per-row download, zip of all (`/motion/[nodeId]/batch/[batchId]`,
  streamed with fflate).
- Agent: `expose_field`, `unexpose_field`, `list_fields`, `render_batch` (first call quotes and
  returns `needs_confirmation`; renders only with `confirm: true`; refuses while the turn has
  unsaved edits, since the saved revision is what renders). Parity table updated.

**Discarded.** Server-side retry of failed rows: the job file is cleaned on failure, so "retry"
is re-submitting the failed rows from the dialog. A server-side zip stored in Storage: it would hit
the same per-file limit as the videos; streaming it on download avoids that.
