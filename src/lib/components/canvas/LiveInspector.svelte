<script lang="ts">
  import type { FrameStep } from '$lib/canvas/frame-multi';
  import { FieldKind, LIVE_FIELDS, classOf, fieldValue, type LiveField } from '$lib/canvas/live-fields';
  import { editLive, liveApi, liveChanges, livePush, type LiveChangesView } from '$lib/canvas/live-edit-client';
  import type { LiveSelected } from '$lib/canvas/live-selection.svelte';

  let { selected, onstep, onfail }: { selected: LiveSelected; onstep: (step: FrameStep) => void; onfail: (message: string) => void } = $props();

  const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
  const RGB = /rgba?\((\d+),\s*(\d+),\s*(\d+)/;

  const pick = $derived(selected.pick);
  const fields = $derived(pick ? LIVE_FIELDS.filter((f) => f.kind !== FieldKind.Text || pick.text !== null) : []);
  let changes = $state<LiveChangesView | null>(null);
  let note = $state<string | null>(null);
  let showPatch = $state(false);

  const hexOf = (raw: string) => {
    const m = raw.match(RGB);
    return m ? `#${m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : '#000000';
  };

  const pxOf = (raw: string) => String(Math.round(parseFloat(raw) || 0));

  async function loadChanges() {
    changes = await liveChanges().catch(() => null);
  }

  $effect(() => {
    void loadChanges();
  });

  async function commit(field: LiveField, value: string) {
    if (!pick || value === fieldValue(field, pick)) {
      return;
    }
    const out = await editLive(liveApi, pick, field, value, selected.preview);
    if (!out.ok) {
      onfail(`Not written to the code: ${out.reason}`);
      return;
    }
    onstep(out.step);
    await loadChanges();
  }

  async function push() {
    note = null;
    const out = await livePush();
    note = out.ok ? `Pushed on ${out.branch}.` : `Not pushed: ${out.message ?? 'unknown error'}`;
  }

  const committed = (field: LiveField) => (e: Event) => void commit(field, (e.currentTarget as HTMLInputElement).value);
</script>

<aside class="panel rounded-lg" data-testid="live-inspector" aria-label="Live element">
  {#if selected.untagged}
    <p class="note" data-testid="live-inspector-untagged">This element is not tagged with its source, so it is read-only. Run <code>feega init</code> in the app folder and restart the dev server.</p>
  {:else if pick}
    <header>
      <span class="source" title={pick.source} data-testid="live-inspector-source">{pick.source}</span>
    </header>
    {#each fields as field (field.key)}
      {@const value = fieldValue(field, pick)}
      {@const token = classOf(field, pick.classes)}
      <label class="row">
        <span class="label">{field.label}</span>
        {#if field.kind === FieldKind.Text}
          <textarea class="rounded-sm" rows="2" value={value} onchange={committed(field)} data-testid={`live-field-${field.key}`}></textarea>
        {:else if field.kind === FieldKind.Colour}
          <input class="swatch rounded-xs" type="color" value={hexOf(value)} onchange={committed(field)} data-testid={`live-field-${field.key}`} />
        {:else if field.kind === FieldKind.Weight}
          <select class="rounded-sm" value={value} onchange={committed(field)} data-testid={`live-field-${field.key}`}>
            {#each WEIGHTS as w (w)}<option value={w}>{w}</option>{/each}
          </select>
        {:else}
          <input class="rounded-sm" type="number" value={pxOf(value)} onchange={committed(field)} data-testid={`live-field-${field.key}`} />
        {/if}
        {#if token}<code class="token rounded-xs">{token}</code>{/if}
      </label>
    {/each}
    {#if changes?.files.length}
      <section class="changes" data-testid="live-changes">
        <div class="row">
          <span class="label">{changes.files.length} file{changes.files.length === 1 ? '' : 's'} on {changes.branch}</span>
          <button class="btn rounded-sm" type="button" onclick={() => (showPatch = !showPatch)}>{showPatch ? 'Hide' : 'Diff'}</button>
          <button class="btn primary rounded-sm" type="button" onclick={push} data-testid="live-push">Push</button>
        </div>
        {#if showPatch}<pre class="patch rounded-sm">{changes.patch}</pre>{/if}
        {#if note}<p class="note">{note}</p>{/if}
      </section>
    {/if}
  {/if}
</aside>

<style>
  .panel { position: fixed; right: 16px; top: 72px; z-index: 60; width: 280px; max-height: calc(100vh - 96px); overflow: auto; background: var(--paper, #fff); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.35); padding: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; }
  .source { font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--ink-soft, #6e6e73); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
  .row { display: flex; align-items: center; gap: 8px; }
  .label { flex: 1; color: var(--ink-soft, #6e6e73); }
  textarea { flex: 2; font: inherit; padding: 4px 6px; border: 1px solid var(--line, #e3e3e6); resize: vertical; }
  input[type='number'], select { width: 64px; font: inherit; padding: 3px 6px; border: 1px solid var(--line, #e3e3e6); background: var(--paper, #fff); color: inherit; }
  .swatch { width: 28px; height: 22px; padding: 0; border: 1px solid var(--line, #e3e3e6); }
  .token { font-size: 10.5px; padding: 1px 4px; background: var(--paper-soft, #f5f5f7); max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .changes { border-top: 1px solid var(--line, #e3e3e6); padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
  .btn { font: inherit; font-size: 12px; padding: 3px 10px; border: 1px solid var(--line, #e3e3e6); background: transparent; color: inherit; cursor: pointer; }
  .btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); border-color: transparent; }
  .patch { max-height: 200px; overflow: auto; font-size: 10.5px; background: var(--paper-soft, #f5f5f7); padding: 6px; margin: 0; }
  .note { margin: 0; color: var(--ink-soft, #6e6e73); }
</style>
