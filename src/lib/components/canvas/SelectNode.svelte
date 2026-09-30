<script lang="ts">
  import TieredImage from './TieredImage.svelte';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ImageIcon from '@lucide/svelte/icons/image';
  import HelpCircle from '@lucide/svelte/icons/help-circle';
  import { clampIndex, type SelectNode } from '$lib/canvas/select-node';
  import { listLabel, type ListNode } from '$lib/canvas/list-node';
  import { requestGuide } from '$lib/canvas/guide-open';
  import Plus from '@lucide/svelte/icons/plus';
  import X from '@lucide/svelte/icons/x';
  import { CONNECTOR_STYLE } from '$lib/canvas/connectors';
  import { addOutput, fieldsFor, removeOutput, renameOutput, type OutputValue, type SelectOutput } from '$lib/canvas/select-outputs';
  import type { FieldValue } from '$lib/canvas/select-sources';

  let {
    node,
    list = null,
    outputs = [],
    values = {},
    sourceType = null,
    preview,
    onchange
  }: {
    node: SelectNode;
    list?: ListNode | null;
    outputs?: SelectOutput[];
    values?: Record<string, OutputValue>;
    sourceType?: string | null;
    preview?: (field: string) => FieldValue | null;
    onchange?: (patch: Partial<SelectNode>) => void;
  } = $props();

  const PREVIEW_CHARS = 60;

  let picking = $state(false);
  let query = $state('');

  const fields = $derived(fieldsFor(sourceType));
  const taken = $derived(new Set(node.outputs.map((o) => o.field)));
  const matches = $derived(
    fields.filter((f) => !taken.has(f.key) && `${f.label} ${f.key}`.toLowerCase().includes(query.trim().toLowerCase()))
  );

  function summary(value: FieldValue | null | undefined): string {
    if (!value) {
      return '—';
    }
    if (value.mediaUrls.length) {
      return value.mediaUrls.length === 1 ? '1 file' : `${value.mediaUrls.length} files`;
    }
    const text = value.text?.trim() ?? '';
    return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text || '—';
  }

  function pick(field: string) {
    onchange?.({ outputs: addOutput(node.outputs, field, () => crypto.randomUUID()) });
    picking = false;
    query = '';
  }

  const length = $derived(list?.items.length ?? 0);
  const current = $derived(list && length ? list.items[Math.min(node.index, length) - 1] : null);

  function setIndex(next: number) {
    onchange?.({ index: clampIndex(next, length) });
  }

  function prev() {
    setIndex(node.index - 1);
  }
  function next() {
    setIndex(node.index + 1);
  }
</script>

<div class="select">
  <header class="select-head">
    <button type="button" class="select-nav" onclick={prev} disabled={!length || node.index <= 1} aria-label="Precedente">
      <ChevronLeft size={14} strokeWidth={2} />
    </button>

    <input
      class="select-index"
      type="number"
      min="1"
      value={node.index}
      oninput={(e) => setIndex(Number(e.currentTarget.value))}
      aria-label="Indice"
    />
    {#if length}
      <span class="select-total">/ {length}</span>
    {/if}

    <button type="button" class="select-nav" onclick={next} disabled={!length || node.index >= length} aria-label="Successivo">
      <ChevronRight size={14} strokeWidth={2} />
    </button>

    <button type="button" class="select-help" onclick={() => requestGuide('loop')} aria-label="Guida">
      <HelpCircle size={13} strokeWidth={2} />
    </button>
  </header>

  <div class="select-body">
    {#if !list}
      <p class="select-empty">
        Picks one item from a connected list, by number.<br />Connect a list, products or a feed
      </p>
    {:else if !length}
      <p class="select-empty">Empty list</p>
    {:else if current}
      {#if list.itemKind === 'image' && current.url}
        <TieredImage src={current.url} nodeId={node.id} alt={listLabel(current, node.index - 1)} fit="cover" />
      {:else if list.itemKind === 'image'}
        <div class="select-photo select-photo-empty"><ImageIcon size={22} strokeWidth={1.5} /></div>
      {:else}
        <p class="select-text">{current.text ?? listLabel(current, node.index - 1)}</p>
      {/if}
    {/if}
  </div>

  {#if outputs.length || fields.length}
    <ul class="select-outputs nowheel nodrag" aria-label="Outputs">
      {#each outputs as out (out.handle)}
        <li class="select-output" class:is-flagged={out.incompatible} style={`--port:${CONNECTOR_STYLE[out.port].color}`}>
          <span class="select-output-swatch" aria-hidden="true"></span>
          {#if out.custom}
            {@const custom = out.custom}
            <input
              class="select-output-label"
              value={out.label}
              aria-label="Output name"
              onchange={(e) => onchange?.({ outputs: renameOutput(node.outputs, custom.id, e.currentTarget.value) })}
            />
          {:else}
            <span class="select-output-label">{out.label}</span>
          {/if}
          {#if out.incompatible}
            <span class="select-output-value" title="This field is not available for the connected source">Not available</span>
          {:else}
            {@const value = values[out.handle]}
            {#if value?.mediaUrls[0] && out.port === 'images'}
              <img class="select-output-thumb" src={value.mediaUrls[0]} alt="" loading="lazy" />
            {/if}
            <span class="select-output-value">{summary(value)}</span>
          {/if}
          {#if out.custom}
            {@const custom = out.custom}
            <button type="button" class="select-output-remove" aria-label="Remove output" onclick={() => onchange?.({ outputs: removeOutput(node.outputs, custom.id) })}>
              <X size={12} strokeWidth={2} />
            </button>
          {/if}
        </li>
      {/each}
    </ul>

    {#if fields.length}
      {#if picking}
        <div class="select-picker nowheel nodrag">
          <input class="select-picker-search" placeholder="Search fields" bind:value={query} aria-label="Search fields" />
          <ul class="select-picker-list">
            {#each matches as f (f.key)}
              <li>
                <button type="button" class="select-picker-item" style={`--port:${CONNECTOR_STYLE[f.port].color}`} onclick={() => pick(f.key)}>
                  <span class="select-output-swatch" aria-hidden="true"></span>
                  <span class="select-output-label">{f.label}</span>
                  <span class="select-output-value">{summary(preview?.(f.key))}</span>
                </button>
              </li>
            {:else}
              <li class="select-empty">No field left</li>
            {/each}
          </ul>
        </div>
      {:else}
        <button type="button" class="select-add nodrag" onclick={() => (picking = true)}>
          <Plus size={12} strokeWidth={2} /> Output
        </button>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .select {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e5e5e5);
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.05),
      0 8px 24px -12px rgb(0 0 0 / 0.2);
    overflow: hidden;
    transition: box-shadow 140ms ease;
  }
  .select:hover {
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.06),
      0 12px 32px -14px rgb(0 0 0 / 0.26);
  }
  @media (prefers-reduced-motion: reduce) {
    .select {
      transition: none;
    }
  }

  .select-head {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--line, #e5e5e5);
  }

  .select-nav {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--ink-soft, #6e6e73);
    background: none;
    border: 1px solid var(--line-2, #d2d2d7);
    cursor: pointer;
  }
  .select-nav:hover:not(:disabled) {
    color: var(--ink, #1d1d1f);
    background: var(--paper-2, #f9f9f9);
  }
  .select-nav:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .select-help {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-left: auto;
    color: var(--ink-soft, #6e6e73);
    background: none;
    border: none;
    cursor: pointer;
  }
  .select-help:hover {
    color: var(--ink, #1d1d1f);
  }

  .select-index {
    width: 44px;
    padding: 2px 5px;
    font: inherit;
    font-size: 12px;
    text-align: center;
    color: var(--ink, #1d1d1f);
    background: var(--paper-2, #f9f9f9);
    border: 1px solid var(--line-2, #d2d2d7);
  }
  .select-total {
    font-size: 11px;
    color: var(--ink-soft, #6e6e73);
  }

  .select-body {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .select-empty {
    margin: 0;
    padding: 10px;
    font-size: 11.5px;
    color: var(--ink-soft, #6e6e73);
    text-align: center;
  }

  .select-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--paper-2, #f9f9f9);
  }
  .select-photo-empty {
    display: grid;
    place-content: center;
    color: var(--ink-soft, #6e6e73);
  }

  .select-outputs,
  .select-picker-list {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 120px;
    overflow: auto;
    border-top: 1px solid var(--line, #e5e5e5);
  }
  .select-output,
  .select-picker-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    font: inherit;
    font-size: 11px;
    color: var(--ink, #1d1d1f);
    background: none;
    border: none;
    text-align: left;
  }
  .select-picker-item {
    cursor: pointer;
  }
  .select-picker-item:hover {
    background: var(--paper-2, #f9f9f9);
  }
  .select-output.is-flagged {
    color: var(--ink-soft, #6e6e73);
  }
  .select-output.is-flagged .select-output-label {
    text-decoration: line-through;
  }
  .select-output-swatch {
    flex: none;
    width: 8px;
    height: 8px;
    background: var(--port);
  }
  .select-output-label {
    flex: none;
    width: 84px;
    padding: 0;
    font: inherit;
    font-weight: 600;
    color: inherit;
    background: none;
    border: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .select-output-value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-soft, #6e6e73);
  }
  .select-output-thumb {
    flex: none;
    width: 18px;
    height: 18px;
    object-fit: cover;
  }
  .select-output-remove {
    display: inline-flex;
    flex: none;
    padding: 0;
    color: var(--ink-soft, #6e6e73);
    background: none;
    border: none;
    cursor: pointer;
  }
  .select-add {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 4px 8px 6px;
    padding: 2px 6px;
    font: inherit;
    font-size: 11px;
    color: var(--ink, #1d1d1f);
    background: none;
    border: 1px dashed var(--line-2, #d2d2d7);
    cursor: pointer;
    align-self: flex-start;
  }
  .select-picker {
    border-top: 1px solid var(--line, #e5e5e5);
  }
  .select-picker-search {
    width: 100%;
    padding: 4px 8px;
    font: inherit;
    font-size: 11px;
    border: none;
    border-bottom: 1px solid var(--line, #e5e5e5);
    background: var(--paper-2, #f9f9f9);
  }

  .select-text {
    margin: 0;
    padding: 12px;
    font-size: 12.5px;
    color: var(--ink, #1d1d1f);
    white-space: pre-wrap;
    overflow: auto;
  }
</style>
