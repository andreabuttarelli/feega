<script lang="ts">
  import ComponentPreview from '$lib/components/motion/ComponentPreview.svelte';
  import { FORMATS } from '$lib/motion/doc';
  import { ComponentKind, KIND_LABEL, STARTER_FORMATS, matching, type CatalogueItem, type StarterFormat } from '$lib/motion/template/catalogue';

  let { items, projectId = null }: { items: CatalogueItem[]; projectId?: string | null } = $props();

  const KINDS = Object.values(ComponentKind).filter((k) => items.some((i) => i.kind === k));

  let format = $state<StarterFormat>(STARTER_FORMATS[0]);
  let kind = $state<ComponentKind | null>(null);
  let starting = $state<string | null>(null);

  const shown = $derived(matching(items, '', kind));
</script>

<section class="shelf" aria-labelledby="components-heading" data-testid="home-components">
  <div class="head">
    <h2 id="components-heading">video</h2>
    <div class="formats" role="radiogroup" aria-label="Format">
      {#each STARTER_FORMATS as f (f)}
        <button type="button" role="radio" aria-checked={format === f} class:on={format === f} data-format={f} onclick={() => (format = f)}>{FORMATS[f].label}</button>
      {/each}
    </div>
  </div>

  <div class="kinds" role="tablist" aria-label="Kind">
    <button type="button" role="tab" aria-selected={kind === null} class:on={kind === null} onclick={() => (kind = null)}>all</button>
    {#each KINDS as k (k)}
      <button type="button" role="tab" aria-selected={kind === k} class:on={kind === k} onclick={() => (kind = k)}>{KIND_LABEL[k].toLowerCase()}</button>
    {/each}
  </div>

  <ul class="strip">
    {#each shown as item (item.id)}
      <li data-component={item.id}>
        <form method="POST" action="/app?/fromTemplate" onsubmit={() => (starting = item.id)}>
          <input type="hidden" name="template" value={item.id} />
          <input type="hidden" name="format" value={format} />
          {#if projectId}<input type="hidden" name="projectId" value={projectId} />{/if}
          <ComponentPreview preview={item.preview} name={item.name} />
          <span class="name">{item.name}</span>
          <span class="meta">{item.description}</span>
          <button type="submit" class="use" data-testid="use-component" disabled={starting !== null}>{starting === item.id ? 'opening…' : 'use in new video'}</button>
        </form>
      </li>
    {/each}
  </ul>
</section>

<style>
  .shelf {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-3);
    min-height: 32px;
  }

  h2 {
    margin: 0;
    font-size: var(--ui-text-md);
    font-weight: 500;
    color: var(--ui-text-3);
  }

  .formats,
  .kinds {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .formats button,
  .kinds button {
    flex: none;
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: var(--ui-text-3);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .formats button.on,
  .kinds button.on {
    background: var(--ui-field);
    color: var(--ui-ink);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .strip {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(200px, 1fr);
    gap: var(--ui-space-3);
    overflow-x: auto;
    scrollbar-width: none;
    scroll-snap-type: x proximity;
  }

  .strip li {
    scroll-snap-align: start;
    max-width: 280px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    margin-top: var(--ui-space-2);
    font-size: var(--ui-text-sm);
    font-weight: 500;
  }

  .meta {
    overflow: hidden;
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .use {
    align-self: flex-start;
    height: 30px;
    margin-top: var(--ui-space-2);
    padding: 0 var(--ui-space-4);
    border: 0;
    border-radius: 9999px;
    background: var(--ui-field);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .use:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .use:disabled {
    opacity: 0.6;
    cursor: default;
  }

  @media (max-width: 640px) {
    .head {
      flex-direction: column;
      align-items: flex-start;
    }

    .strip {
      grid-auto-columns: 72%;
    }
  }
</style>
