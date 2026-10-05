<script lang="ts">
  import { onMount } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import Download from '@lucide/svelte/icons/download';
  import { deserialize } from '$app/forms';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { applyValues, exposeField, FieldType, fieldValues, removeField } from '$lib/motion/template/fields';
  import { FIELD_TYPES } from '$lib/motion/template/field-model';
  import { batchRows, DEFAULT_NAME_PATTERN, MAX_BATCH_ROWS, outputName, parseCsv, sheetCsvUrl, type ColumnMap, type CsvTable } from '$lib/motion/template/batch';
  import { renderQuote } from '$lib/motion/render-quote';
  import { EXPORT_FORMATS, FORMAT, Preset, settingsOf, type RenderSettings } from '$lib/motion/export-formats';

  type Cell = { row: number; name: string; runId: string; status: string; error: string | null; assetId: string | null };
  type Batch = { id: string; credits: number; rows: Cell[] };

  let {
    doc,
    clip,
    editorUrl,
    version,
    saved,
    batch: initial,
    assetHref,
    onchange,
    onpreview,
    onclose
  }: {
    doc: MotionDoc;
    clip: MotionClip | null;
    editorUrl: string;
    version: number;
    saved: boolean;
    batch: Batch | null;
    assetHref: (id: string) => string;
    onchange: (result: OpResult, summary: string) => void;
    onpreview: (doc: MotionDoc | null) => void;
    onclose: () => void;
  } = $props();

  const POLL_MS = 3000;
  const SETTLED = new Set(['done', 'failed', 'expired']);
  const TYPE_LABEL: Record<FieldType, string> = { [FieldType.Text]: 'Text', [FieldType.Number]: 'Number', [FieldType.Color]: 'Colour', [FieldType.Asset]: 'Asset', [FieldType.Boolean]: 'Yes / no' };

  let prop = $state('');
  let key = $state('');
  let label = $state('');
  let type = $state<FieldType>(FieldType.Text);

  let source = $state('');
  let sheet = $state('');
  let table = $state<CsvTable>({ headers: [], rows: [] });
  let map = $state<ColumnMap>({});
  let pattern = $state(DEFAULT_NAME_PATTERN);
  let previewRow = $state(1);
  let settings = $state<RenderSettings>(settingsOf(Preset.Social));
  let error = $state('');
  let job = $state<Batch | null>(initial);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fields = $derived(fieldValues(doc));
  const clipProps = $derived(clip ? Object.keys(clip.props) : []);
  const rows = $derived(batchRows(table, map));
  const perVideo = $derived(renderQuote(doc, settings.resolution).credits);
  const running = $derived(job !== null && job.rows.some((r) => !SETTLED.has(r.status)));

  function expose() {
    if (!clip) {
      return;
    }
    onchange(exposeField(doc, { key, label: label || key, type, clipId: clip.id, prop }), `exposed ${key}`);
    key = '';
    label = '';
  }

  function load(text: string) {
    table = parseCsv(text);
    map = Object.fromEntries(doc.fields.map((f) => [f.key, table.headers.find((h) => h.toLowerCase() === f.key || h.toLowerCase() === f.label.toLowerCase()) ?? null]));
    previewRow = 1;
  }

  async function fromFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) {
      source = await file.text();
      load(source);
    }
  }

  async function fromSheet() {
    const url = sheetCsvUrl(sheet);
    if (!url) {
      error = 'Paste a Google Sheets link shared as "anyone with the link".';
      return;
    }
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) {
      error = 'The sheet could not be read: share it as "anyone with the link can view".';
      return;
    }
    source = await res.text();
    load(source);
  }

  function preview() {
    const values = rows[previewRow - 1];
    const filled = values ? applyValues(doc, values) : null;
    error = filled && !filled.ok ? filled.error : '';
    onpreview(filled?.ok ? filled.doc : null);
  }

  async function post(name: string, form: FormData) {
    const res = await fetch(`${editorUrl}?/${name}`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    const result = deserialize(await res.text());
    return result.type === 'success' ? { ok: true, data: (result.data ?? {}) as Record<string, unknown> } : { ok: false, data: (result.type === 'failure' ? result.data : { error: 'request_failed' }) as Record<string, unknown> };
  }

  async function poll() {
    const status = await post('batchStatus', new FormData()).catch(() => null);
    job = (status?.data.batch as Batch | null) ?? job;
    if (running) {
      timer = setTimeout(poll, POLL_MS);
    }
  }

  async function render() {
    error = '';
    const form = new FormData();
    form.set('version', String(version));
    form.set('settings', JSON.stringify(settings));
    form.set('rows', JSON.stringify(rows.map((values, i) => ({ name: outputName(pattern, values, i + 1), values }))));
    const started = await post('renderBatch', form);
    if (!started.ok) {
      error = String(started.data.detail ?? started.data.error ?? 'refused');
      return;
    }
    await poll();
  }

  onMount(() => {
    if (running) {
      timer = setTimeout(poll, POLL_MS);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      onpreview(null);
    };
  });
</script>

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Template" data-testid="template-dialog">
  <header><span>Template</span><button type="button" aria-label="Close" onclick={onclose}><X size={16} /></button></header>

  <section>
    <h3>Fields</h3>
    {#if fields.length}
      <table data-testid="template-fields">
        <thead><tr><th>Key</th><th>Label</th><th>Type</th><th>Clip · prop</th><th>Now</th><th></th></tr></thead>
        <tbody>
          {#each fields as f (f.key)}
            <tr class:missing={f.missing}>
              <td>{f.key}</td><td>{f.label}</td><td>{TYPE_LABEL[f.type]}</td><td>{f.clipId} · {f.prop}</td><td>{f.missing ? 'clip removed' : String(f.value ?? '')}</td>
              <td><button type="button" onclick={() => onchange(removeField(doc, f.key), `removed field ${f.key}`)}>Remove</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No exposed fields yet. Select a clip, pick one of its props and expose it.</p>
    {/if}

    {#if clip}
      <div class="row">
        <select bind:value={prop} data-testid="template-prop">
          <option value="" disabled>Prop of {clip.id}</option>
          {#each clipProps as p (p)}<option value={p}>{p}</option>{/each}
        </select>
        <input placeholder="key, e.g. headline" bind:value={key} data-testid="template-key" />
        <input placeholder="Label" bind:value={label} />
        <select bind:value={type}>{#each FIELD_TYPES as t (t)}<option value={t}>{TYPE_LABEL[t]}</option>{/each}</select>
        <button type="button" onclick={expose} disabled={!prop || !key} data-testid="template-expose">Expose</button>
      </div>
    {/if}
  </section>

  {#if fields.length}
    <section>
      <h3>Batch from CSV or Google Sheet</h3>
      <textarea rows="4" placeholder="Paste CSV (first row = column names)" bind:value={source} oninput={() => load(source)} data-testid="batch-csv"></textarea>
      <div class="row">
        <input type="file" accept=".csv,text/csv,text/tab-separated-values" onchange={fromFile} />
        <input placeholder="Google Sheets link" bind:value={sheet} />
        <button type="button" onclick={fromSheet}>Load sheet</button>
      </div>

      {#if table.headers.length}
        <dl>
          {#each doc.fields as f (f.key)}
            <dt>{f.label}</dt>
            <dd>
              <select bind:value={map[f.key]} data-testid={`batch-map-${f.key}`}>
                <option value={null}>Keep default</option>
                {#each table.headers as h (h)}<option value={h}>{h}</option>{/each}
              </select>
            </dd>
          {/each}
          <dt>File name</dt>
          <dd><input bind:value={pattern} data-testid="batch-pattern" /> <span class="muted">{rows.length ? outputName(pattern, rows[0], 1) : ''}</span></dd>
          <dt>Format</dt>
          <dd><select bind:value={settings.format}>{#each EXPORT_FORMATS as f (f)}<option value={f}>{FORMAT[f].label}</option>{/each}</select></dd>
          <dt>Preview</dt>
          <dd><input type="number" min="1" max={rows.length} bind:value={previewRow} /> <button type="button" onclick={preview} data-testid="batch-preview">Preview row</button> <button type="button" onclick={() => onpreview(null)}>Template</button></dd>
          <dt>Cost</dt>
          <dd data-testid="batch-quote">{rows.length} videos × ~{perVideo} = about {rows.length * perVideo} credits, each paid by the time it really takes when it is ready.</dd>
        </dl>
        {#if rows.length > MAX_BATCH_ROWS}<p class="warn">At most {MAX_BATCH_ROWS} rows per batch.</p>{/if}
        <button type="button" class="primary" onclick={render} disabled={!saved || running || !rows.length || rows.length > MAX_BATCH_ROWS} data-testid="batch-render">{saved ? `Render ${rows.length} videos · ${rows.length * perVideo} credits` : 'Saving your changes…'}</button>
      {/if}
    </section>
  {/if}

  {#if error}<p class="warn" role="alert">{error}</p>{/if}

  {#if job}
    <section data-testid="batch-grid">
      <h3>Batch · {job.rows.filter((r) => r.status === 'done').length}/{job.rows.length} done</h3>
      <div class="grid">
        {#each job.rows as r (r.runId)}
          <div class={`cell ${r.status}`} title={r.error ?? r.status}>
            <span>{r.row}. {r.name}</span>
            {#if r.assetId}<a href={assetHref(r.assetId)} download={r.name}><Download size={12} /></a>{:else}<span class="muted">{r.error ? 'failed' : r.status}</span>{/if}
          </div>
        {/each}
      </div>
      {#if !running && job.rows.some((r) => r.assetId)}<a class="primary" href={`${editorUrl}/batch/${job.id}`} data-testid="batch-zip"><Download size={14} /> Download all (.zip)</a>{/if}
    </section>
  {/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 40;
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(720px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow: auto;
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line);
    font-size: 13px;
  }

  header {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
  }

  h3 {
    margin: 0 0 6px;
    font-size: 12px;
    text-transform: uppercase;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: 4px;
    border-bottom: 1px solid var(--ui-line);
  }

  .missing {
    opacity: 0.5;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  textarea {
    width: 100%;
    font-family: monospace;
  }

  dl {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 6px 12px;
  }

  dt {
    color: var(--ui-ink-muted, inherit);
  }

  dd {
    margin: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 4px;
  }

  .cell {
    display: flex;
    justify-content: space-between;
    padding: 6px;
    border: 1px solid var(--ui-line);
  }

  .cell.done {
    border-color: #16a34a;
  }

  .cell.failed,
  .cell.expired {
    border-color: #dc2626;
  }

  .muted {
    opacity: 0.7;
  }

  .warn {
    color: #dc2626;
  }

  .primary {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    background: var(--ui-ink);
    color: var(--ui-bg);
  }
</style>
