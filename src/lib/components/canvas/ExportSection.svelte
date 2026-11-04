<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import Minus from '@lucide/svelte/icons/minus';
  import { IconButton, IconSize } from '$lib/components/ui/shell';
  import { attachmentUrl } from '@feega/motion-core/motion/still-model';
  import { FILE, FILE_FORMATS, FileFormat, SizeBy, nextExportRow, scaleSuffix, type ExportRow } from '$lib/motion/export-rows';
  import type { ExportMade } from './frame-properties.svelte';

  let { name, onexport }: { name: string; onexport: (rows: ExportRow[]) => Promise<ExportMade | string> } = $props();

  const SCALES = [0.5, 0.75, 1, 1.5, 2, 3, 4];

  let rows = $state<ExportRow[]>([nextExportRow([])]);
  let working = $state(false);
  let error = $state('');
  let made = $state<ExportMade | null>(null);

  const scaleLabel = (value: number) => `${value}x`;

  function patch(index: number, next: Partial<ExportRow>) {
    rows = rows.map((row, i) => (i === index ? { ...row, ...next } : row));
  }

  function download(file: ExportMade) {
    const link = document.createElement('a');
    link.href = attachmentUrl(file.url, file.name);
    link.download = file.name;
    link.click();
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
    download(out);
  }
</script>

<section class="section ui-section" data-testid="export-section">
  <header>
    <h3>Export</h3>
    <IconButton label="Add export setting" size={IconSize.Sm} data-testid="export-add" onclick={() => (rows = [...rows, nextExportRow(rows)])}><Plus /></IconButton>
  </header>
  {#each rows as row, i (i)}
    <div class="row" data-testid="export-row">
      <select aria-label="Export scale" value={row.by === SizeBy.Scale ? row.value : 1} onchange={(e) => patch(i, { by: SizeBy.Scale, value: Number(e.currentTarget.value), suffix: scaleSuffix(Number(e.currentTarget.value)) })}>
        {#each SCALES as scale (scale)}<option value={scale}>{scaleLabel(scale)}</option>{/each}
      </select>
      <select aria-label="Export format" value={row.format} onchange={(e) => patch(i, { format: e.currentTarget.value as FileFormat })}>
        {#each FILE_FORMATS as format (format)}<option value={format}>{FILE[format].label}</option>{/each}
      </select>
      <IconButton label="Remove export setting" size={IconSize.Sm} onclick={() => (rows = rows.filter((_, j) => j !== i))}><Minus /></IconButton>
    </div>
  {/each}
  {#if rows.length}
    <button type="button" class="go" disabled={working} onclick={go} data-testid="export-go">{working ? 'Exporting…' : `Export ${name}`}</button>
  {/if}
  {#if error}<p class="note warn" role="alert">{error}</p>{/if}
  {#if made?.skipped?.length}<p class="note warn" role="status">Left out of the file: {made.skipped.join('; ')}.</p>{/if}
  {#if made}<a class="note" href={attachmentUrl(made.url, made.name)} download={made.name} data-testid="export-file">Download {made.name} again</a>{/if}
</section>

<style>
  .section {
    display: grid;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3);
    border-bottom: 1px solid var(--ui-line);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h3 {
    margin: 0;
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: var(--ui-space-2);
    align-items: center;
  }

  select {
    min-width: 0;
    height: 28px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
  }

  .go {
    height: 28px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    font-weight: 600;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .go:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .go:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .note {
    margin: 0;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  .warn {
    color: var(--destructive);
  }
</style>
