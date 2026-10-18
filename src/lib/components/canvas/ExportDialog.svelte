<script lang="ts">
  import { attachmentUrl } from '$lib/motion/still-model';
  import { FILE, FILE_FORMATS, FileFormat, LOSSY, MAX_SCALE, MIN_SCALE, SizeBy, type ExportRow } from '$lib/motion/export-rows';

  type Made = { url: string; name: string; files: string[] };

  let { count, onexport, onclose }: { count: number; onexport: (rows: ExportRow[]) => Promise<Made | string>; onclose: () => void } = $props();

  const DEFAULT_QUALITY = 90;
  const SIZE_LABEL: Record<SizeBy, string> = { [SizeBy.Scale]: '×', [SizeBy.Width]: 'w', [SizeBy.Height]: 'h' };

  const fresh = (): ExportRow => ({ format: FileFormat.Png, by: SizeBy.Scale, value: 1, suffix: '', transparent: false });

  let rows = $state<ExportRow[]>([fresh()]);
  let working = $state(false);
  let error = $state('');
  let made = $state<Made | null>(null);

  function patch(index: number, next: Partial<ExportRow>) {
    rows = rows.map((row, i) => (i === index ? withQuality({ ...row, ...next }) : row));
  }

  function withQuality(row: ExportRow): ExportRow {
    if (!LOSSY.has(row.format)) {
      const { quality: _drop, ...rest } = row;
      return rest;
    }
    return { ...row, quality: row.quality ?? DEFAULT_QUALITY };
  }

  async function go() {
    working = true;
    error = '';
    made = null;
    const out = await onexport(rows);
    working = false;
    if (typeof out === 'string') {
      error = out;
      return;
    }
    made = out;
  }
</script>

<div class="fx-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && !working && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="fx-card" role="dialog" aria-modal="true" aria-label="Export" data-testid="export-dialog">
    <h3>Export {count === 1 ? 'frame' : `${count} frames`}</h3>
    {#each rows as row, i (i)}
      <div class="fx-line" data-testid="export-row">
        <input type="number" aria-label="Size" min={row.by === SizeBy.Scale ? MIN_SCALE : 1} max={row.by === SizeBy.Scale ? MAX_SCALE : undefined} step={row.by === SizeBy.Scale ? 0.5 : 1} value={row.value} onchange={(e) => patch(i, { value: Number(e.currentTarget.value) })} />
        <select aria-label="Size by" value={row.by} onchange={(e) => patch(i, { by: e.currentTarget.value as SizeBy, value: e.currentTarget.value === SizeBy.Scale ? 1 : 1080 })}>
          {#each Object.values(SizeBy) as by (by)}<option value={by}>{SIZE_LABEL[by]}</option>{/each}
        </select>
        <input type="text" aria-label="Suffix" placeholder="Suffix" value={row.suffix} onchange={(e) => patch(i, { suffix: e.currentTarget.value })} />
        <select aria-label="Format" value={row.format} onchange={(e) => patch(i, { format: e.currentTarget.value as FileFormat })}>
          {#each FILE_FORMATS as f (f)}<option value={f}>{FILE[f].label}</option>{/each}
        </select>
        {#if row.quality !== undefined}
          <input type="number" aria-label="Quality" min="1" max="100" value={row.quality} onchange={(e) => patch(i, { quality: Number(e.currentTarget.value) })} />
        {/if}
        <label class="fx-check"><input type="checkbox" aria-label="Transparent background" checked={row.transparent} onchange={(e) => patch(i, { transparent: e.currentTarget.checked })} />No bg</label>
        {#if rows.length > 1}<button type="button" class="fx-x" aria-label="Remove row" onclick={() => (rows = rows.filter((_, j) => j !== i))}>×</button>{/if}
      </div>
    {/each}
    <button type="button" class="fx-btn" onclick={() => (rows = [...rows, fresh()])} data-testid="export-add">Add setting</button>
    {#if error}<p class="fx-warn" role="alert">{error}</p>{/if}
    {#if made}<a class="fx-btn primary" href={attachmentUrl(made.url, made.name)} download={made.name} data-testid="export-file">Download {made.name}</a>{/if}
    <div class="fx-actions">
      <button class="fx-btn" type="button" disabled={working} onclick={onclose}>Close</button>
      <button class="fx-btn primary" type="button" disabled={working} onclick={go} data-testid="export-go">{working ? 'Drawing…' : 'Export'}</button>
    </div>
  </div>
</div>

<style>
  .fx-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .fx-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 520px; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 8px; }
  .fx-card h3 { margin: 0 0 6px; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .fx-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; }
  .fx-line input[type='number'] { width: 64px; }
  .fx-line input[type='text'] { width: 80px; }
  .fx-line input, .fx-line select { font: inherit; font-size: 13px; padding: 4px 6px; border: 1px solid var(--line, #e3e3e6); background: var(--paper, #fff); color: var(--ink, #1d1d1f); }
  .fx-check { display: flex; align-items: center; gap: 4px; }
  .fx-x { border: 0; background: none; cursor: pointer; font-size: 16px; color: var(--ink-soft, #6e6e73); }
  .fx-warn { color: #b3261e; font-size: 13px; margin: 0; }
  .fx-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
  .fx-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); text-align: center; text-decoration: none; }
  .fx-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .fx-btn:disabled { opacity: 0.5; cursor: default; }
</style>
