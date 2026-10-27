<script lang="ts">
  import { onDestroy } from 'svelte';
  import { BATCH_MAX_ROWS, autoMapping, parseRows, type ColumnMapping } from '$lib/canvas/technique-batch';
  import type { TechniqueSlot } from '$lib/canvas/technique';

  type Preview = { rows: number; creditsPerRow: number; credits: number };
  type Started = { workflowIds: string[]; runIds: string[] };
  type Progress = { total: number; done: number; failed: number; running: number };

  let {
    name,
    inputs,
    onpreview,
    onstart,
    onprogress,
    oncancel,
    onclose
  }: {
    name: string;
    inputs: TechniqueSlot[];
    onpreview: (rows: string[][], mapping: ColumnMapping) => Promise<Preview | null>;
    onstart: (rows: string[][], mapping: ColumnMapping) => Promise<Started | null>;
    onprogress: (runIds: string[]) => Promise<Progress | null>;
    oncancel: (workflowIds: string[]) => Promise<void>;
    onclose: () => void;
  } = $props();

  const POLL_MS = 3000;

  let text = $state('');
  let picked = $state<ColumnMapping | null>(null);
  let preview = $state<Preview | null>(null);
  let started = $state<Started | null>(null);
  let progress = $state<Progress | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  const rows = $derived(parseRows(text));
  const columns = $derived(Math.max(0, ...rows.map((r) => r.length)));
  const mapping = $derived(picked ?? autoMapping(inputs.length, columns));
  const tooMany = $derived(rows.length > BATCH_MAX_ROWS);
  const ready = $derived(rows.length > 0 && !tooMany);
  const finished = $derived(progress !== null && progress.done + progress.failed >= progress.total);

  function edited() {
    preview = null;
  }

  async function readFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) {
      text = await file.text();
      edited();
    }
  }

  function pick(slot: number, value: string) {
    const next = [...mapping];
    next[slot] = value === '' ? null : Number(value);
    picked = next;
    edited();
  }

  async function estimate() {
    preview = await onpreview(rows, mapping);
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function poll(runIds: string[]) {
    progress = (await onprogress(runIds)) ?? progress;
    if (finished) {
      stopPolling();
    }
  }

  async function start() {
    started = await onstart(rows, mapping);
    if (!started) {
      return;
    }

    const runIds = started.runIds;
    progress = { total: runIds.length, done: 0, failed: 0, running: 0 };
    timer = setInterval(() => void poll(runIds), POLL_MS);
  }

  async function cancel() {
    if (started) {
      await oncancel(started.workflowIds);
    }
    stopPolling();
    onclose();
  }

  onDestroy(stopPolling);
</script>

<div class="tr-overlay" role="button" tabindex="-1" aria-label="Close" onclick={(e) => e.target === e.currentTarget && !started && onclose()} onkeydown={(e) => e.key === 'Escape' && !started && onclose()}>
  <div class="tr-card" role="dialog" aria-modal="true" aria-label="Run technique on a list" data-testid="technique-rows-dialog">
    <h3>Run {name} on a list</h3>

    {#if !started}
      <textarea rows="6" placeholder="One row per line, or paste a CSV. Image inputs take a URL." aria-label="Rows" bind:value={text} oninput={edited} data-testid="technique-rows-text"></textarea>
      <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" aria-label="Load a CSV file" onchange={readFile} />

      {#if rows.length}
        <p class="tr-note" data-testid="technique-rows-count">{rows.length} {rows.length === 1 ? 'row' : 'rows'}{tooMany ? ` · at most ${BATCH_MAX_ROWS}` : ''}</p>
        {#each inputs as slot, i (slot.node)}
          <label class="tr-map">
            <span>{slot.type} input {i + 1}</span>
            <select value={mapping[i] === null || mapping[i] === undefined ? '' : String(mapping[i])} onchange={(e) => pick(i, e.currentTarget.value)}>
              <option value="">Not filled</option>
              {#each Array.from({ length: columns }, (_, c) => c) as c (c)}
                <option value={String(c)}>Column {c + 1} · {rows[0]?.[c] ?? ''}</option>
              {/each}
            </select>
          </label>
        {/each}
      {/if}

      {#if preview}
        <p class="tr-cost" data-testid="technique-rows-cost">{preview.credits} credits · {preview.creditsPerRow} per row</p>
      {/if}

      <div class="tr-actions">
        <button type="button" class="tr-btn" onclick={onclose}>Cancel</button>
        {#if preview}
          <button type="button" class="tr-btn primary" disabled={!ready} onclick={start} data-testid="technique-rows-start">Start</button>
        {:else}
          <button type="button" class="tr-btn primary" disabled={!ready} onclick={estimate} data-testid="technique-rows-estimate">See the cost</button>
        {/if}
      </div>
    {:else}
      <p class="tr-note" data-testid="technique-rows-progress">
        {progress?.done ?? 0} of {progress?.total ?? 0} done{progress?.failed ? ` · ${progress.failed} failed` : ''}. Results land on the Technique runs canvas, one group per row.
      </p>
      <div class="tr-actions">
        {#if finished}
          <button type="button" class="tr-btn primary" onclick={onclose}>Close</button>
        {:else}
          <button type="button" class="tr-btn" onclick={onclose}>Hide</button>
          <button type="button" class="tr-btn" onclick={cancel} data-testid="technique-rows-cancel">Stop the rest</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .tr-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .tr-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 480px; max-height: 80vh; overflow: auto; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 10px; }
  .tr-card h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  textarea { font: inherit; font-size: 13px; padding: 8px; border: 1px solid var(--line, #e3e3e6); resize: vertical; }
  .tr-map { display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px; align-items: center; font-size: 13px; }
  .tr-map select { font: inherit; font-size: 13px; padding: 5px 6px; border: 1px solid var(--line, #e3e3e6); }
  .tr-note { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .tr-cost { margin: 0; font-size: 14px; font-weight: 600; }
  .tr-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .tr-btn { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 12px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); }
  .tr-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .tr-btn:disabled { opacity: 0.5; cursor: default; }
</style>
