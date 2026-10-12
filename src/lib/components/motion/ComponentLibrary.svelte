<script lang="ts">
  import IconButton from './IconButton.svelte';
  import ComponentPreview from './ComponentPreview.svelte';
  import { Action } from '$lib/motion/actions';
  import { ComponentKind, KIND_LABEL, matching, type CatalogueItem } from '$lib/motion/template/catalogue';

  let { items, onpick, onclose }: { items: CatalogueItem[]; onpick: (id: string, sounds: boolean) => void; onclose: () => void } = $props();

  const KINDS = Object.values(ComponentKind).filter((k) => items.some((i) => i.kind === k));

  let query = $state('');
  let kind = $state<ComponentKind | null>(null);
  let chosenId = $state<string | null>(null);
  let sounds = $state(true);

  const shown = $derived(matching(items, query, kind));
  const chosen = $derived(items.find((i) => i.id === chosenId) ?? null);
</script>

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Components" data-testid="component-library">
  <header>
    <span>Components</span>
    <input type="search" placeholder="Search" aria-label="Search components" bind:value={query} data-testid="component-search" />
    <IconButton action={Action.Close} onclick={onclose} />
  </header>

  <div class="kinds" role="tablist" aria-label="Kind">
    <button type="button" role="tab" aria-selected={kind === null} class:on={kind === null} onclick={() => (kind = null)}>All</button>
    {#each KINDS as k (k)}
      <button type="button" role="tab" aria-selected={kind === k} class:on={kind === k} data-kind={k} onclick={() => (kind = k)}>{KIND_LABEL[k]}</button>
    {/each}
  </div>

  {#if chosen}
    <section class="detail" data-testid="component-detail">
      <div class="big"><ComponentPreview preview={chosen.preview} name={chosen.name} live /></div>
      <div class="about">
        <h3>{chosen.name}</h3>
        <p>{chosen.description}</p>
        <p class="meta">{KIND_LABEL[chosen.kind]} · {chosen.seconds.toFixed(1)}s</p>
        <label class="sounds"><input type="checkbox" bind:checked={sounds} /> Add its sounds</label>
        <div class="actions">
          <button type="button" class="ghost" onclick={() => (chosenId = null)}>Back</button>
          <button type="button" class="primary" data-testid="insert-component" onclick={() => onpick(chosen.id, sounds)}>Insert at playhead</button>
        </div>
        <ul class="fields">
          {#each chosen.fields as f, i (i)}<li><span>{f.label}</span><span>{f.type}</span></li>{/each}
        </ul>
      </div>
    </section>
  {:else}
    <ul class="grid" data-testid="component-grid">
      {#each shown as item (item.id)}
        <li>
          <button type="button" class="card" data-component={item.id} onclick={() => (chosenId = item.id)}>
            <ComponentPreview preview={item.preview} name={item.name} />
            <span class="name">{item.name}</span>
            <span class="meta">{KIND_LABEL[item.kind]} · {item.seconds.toFixed(1)}s</span>
          </button>
        </li>
      {:else}
        <li class="none">No component matches.</li>
      {/each}
    </ul>
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
    width: min(960px, calc(100vw - 32px));
    height: min(680px, calc(100dvh - 32px));
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line);
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
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
    height: 28px;
    padding: 0 12px;
    border: 1px solid var(--ui-line);
    border-radius: 9999px;
    background: none;
    color: var(--ui-ink-2);
    font: inherit;
    font-size: 12px;
  }

  .kinds button.on {
    background: var(--ui-ink);
    color: var(--ui-bg);
    border-color: var(--ui-ink);
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px 12px;
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

  .name {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 500;
  }

  .meta {
    font-size: 11px;
    color: var(--ui-ink-2);
  }

  .none {
    color: var(--ui-ink-2);
  }

  .detail {
    flex: 1;
    overflow: auto;
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: 16px;
    align-content: start;
  }

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }

  .about {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .about p {
    margin: 0;
  }

  .fields {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 12px;
  }

  .fields li {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid var(--ui-line);
  }

  .fields li span + span {
    color: var(--ui-ink-2);
  }

  .sounds {
    font-size: 12px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .actions button {
    height: 36px;
    padding: 0 16px;
    border-radius: 9999px;
    font: inherit;
    font-size: 13px;
  }

  .ghost {
    border: 1px solid var(--ui-line);
    background: none;
    color: inherit;
  }

  .primary {
    flex: 1;
    border: 0;
    background: var(--ui-ink);
    color: var(--ui-bg);
  }

  @media (max-width: 640px) {
    .dialog {
      inset: 0;
      transform: none;
      width: 100vw;
      height: 100dvh;
      border: 0;
    }

    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .detail {
      grid-template-columns: 1fr;
    }
  }
</style>
