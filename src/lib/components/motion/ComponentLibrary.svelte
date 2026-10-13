<script lang="ts">
  import { tick } from 'svelte';
  import type { AssetKind } from '$lib/motion/components';
  import IconButton from './IconButton.svelte';
  import ComponentPreview from './ComponentPreview.svelte';
  import ComponentDetail from './ComponentDetail.svelte';
  import { Action } from '$lib/motion/actions';
  import { Dismiss, dismissFrom, gridStep } from '$lib/motion/template/browser';
  import { DocMode } from '$lib/motion/still';
  import { AddTarget, ComponentKind, KIND_LABEL, matching, type CatalogueItem, type StarterFormat } from '$lib/motion/template/catalogue';
  import type { Instance } from '$lib/motion/template/library';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let {
    items,
    format,
    draftOf,
    compose = null,
    assets = [],
    target = AddTarget.Video,
    onpick,
    onclose
  }: {
    items: CatalogueItem[];
    format: StarterFormat;
    draftOf: (id: string, format: StarterFormat) => Instance | null;
    compose?: ((doc: Instance['doc']) => string) | null;
    assets?: Asset[];
    target?: AddTarget;
    onpick: (id: string, sounds: boolean, draft: Instance | null) => void;
    onclose: () => void;
  } = $props();

  const KINDS = Object.values(ComponentKind).filter((k) => items.some((i) => i.kind === k));

  let query = $state('');
  let kind = $state<ComponentKind | null>(null);
  let mode = $state<DocMode | null>(null);
  const MODE_LABEL: Record<DocMode, string> = { [DocMode.Video]: 'Videos', [DocMode.Still]: 'Stills' };
  let openId = $state<string | null>(null);
  let grid = $state<HTMLUListElement | null>(null);

  const shown = $derived(matching(items, query, kind, mode));
  const open = $derived(items.find((i) => i.id === openId) ?? null);

  const cards = () => [...(grid?.querySelectorAll<HTMLButtonElement>('[data-component]') ?? [])];
  const columns = () => {
    const [first, ...rest] = cards();
    return first ? 1 + rest.filter((c) => c.offsetTop === first.offsetTop).length : 1;
  };

  async function closeDetail() {
    const id = openId;
    openId = null;
    await tick();
    cards().find((c) => c.dataset.component === id)?.focus();
  }

  function outside(e: MouseEvent) {
    if (open && e.target === e.currentTarget) {
      void closeDetail();
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') {
      return;
    }
    e.preventDefault();
    if (dismissFrom(openId) === Dismiss.Detail) {
      void closeDetail();
      return;
    }
    onclose();
  }

  function move(e: KeyboardEvent, at: number) {
    const next = gridStep(at, e.key, { count: shown.length, columns: columns() });
    if (next === null) {
      return;
    }
    e.preventDefault();
    cards()[next]?.focus();
  }
</script>

<svelte:window {onkeydown} />

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" class:open={Boolean(open)} role="dialog" aria-modal="true" aria-label="Components" data-testid="component-library">
  <div class="browse" role="presentation" onclick={outside}>
    <header>
      <h2>components</h2>
      <input type="search" placeholder="Search components" aria-label="Search components" bind:value={query} data-testid="component-search" />
      <IconButton action={Action.Close} onclick={onclose} />
    </header>

    <div class="kinds" role="tablist" aria-label="Video or still">
      <button type="button" role="tab" aria-selected={mode === null} class:on={mode === null} onclick={() => (mode = null)}>Both</button>
      {#each Object.values(DocMode) as m (m)}
        <button type="button" role="tab" aria-selected={mode === m} class:on={mode === m} data-mode-tab={m} onclick={() => (mode = m)}>{MODE_LABEL[m]}</button>
      {/each}
    </div>

    <div class="kinds" role="tablist" aria-label="Category">
      <button type="button" role="tab" aria-selected={kind === null} class:on={kind === null} onclick={() => (kind = null)}>All</button>
      {#each KINDS as k (k)}
        <button type="button" role="tab" aria-selected={kind === k} class:on={kind === k} data-kind={k} onclick={() => (kind = k)}>{KIND_LABEL[k]}</button>
      {/each}
    </div>

    <ul class="grid" bind:this={grid} role="presentation" onclick={outside} data-testid="component-grid">
      {#each shown as item, i (item.id)}
        <li>
          <button type="button" class="card" class:on={item.id === openId} aria-pressed={item.id === openId} data-component={item.id} data-mode={item.mode} onclick={() => (openId = item.id)} onkeydown={(e) => move(e, i)}>
            <ComponentPreview preview={item.preview} name={item.name} />
            <span class="name">{item.name}</span>
            {#if item.description}<span class="line">{item.description}</span>{/if}
          </button>
        </li>
      {:else}
        <li class="none">No component matches.</li>
      {/each}
    </ul>
  </div>

  {#if open}
    <div class="sheet-scrim" role="presentation" onclick={closeDetail}></div>
    {#key open.id}
      <ComponentDetail item={open} {format} {draftOf} {compose} {assets} {target} onadd={(sounds, draft) => onpick(open.id, sounds, draft)} onclose={closeDetail} />
    {/key}
  {/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(0 0 0 / 0.4);
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(1180px, calc(100vw - 32px));
    height: min(760px, calc(100dvh - 32px));
    z-index: 41;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line);
  }

  .dialog.open {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  }

  .browse {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding: 16px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.04em;
  }

  header input {
    flex: 1;
    min-width: 0;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    color: inherit;
    font: inherit;
    font-size: 16px;
  }

  .kinds {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .kinds button {
    flex: none;
    height: 30px;
    padding: 0 14px;
    border: 1px solid var(--ui-line);
    border-radius: 9999px;
    background: none;
    color: var(--ui-ink-2);
    font: inherit;
    font-size: 13px;
  }

  .kinds button.on {
    background: var(--ui-ink);
    color: var(--ui-bg);
    border-color: var(--ui-ink);
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 2px;
    flex: 1;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 20px 14px;
    align-content: start;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .card:focus-visible {
    outline: 2px solid var(--ui-ink);
    outline-offset: 2px;
  }

  .card.on :global(.preview) {
    outline: 2px solid var(--ui-ink);
  }

  .name {
    margin-top: 8px;
    font-size: 14px;
    font-weight: 500;
  }

  .line {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 12px;
    color: var(--ui-ink-2);
  }

  .none {
    color: var(--ui-ink-2);
  }

  .sheet-scrim {
    display: none;
  }

  @media (max-width: 640px) {
    .dialog,
    .dialog.open {
      inset: 0;
      transform: none;
      width: 100vw;
      height: 100dvh;
      border: 0;
      grid-template-columns: minmax(0, 1fr);
    }

    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .sheet-scrim {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 1;
      background: rgb(0 0 0 / 0.4);
    }

    .dialog > :global(.detail) {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
      max-height: 88dvh;
      border-left: 0;
      border-top: 1px solid var(--ui-line);
    }
  }
</style>
