<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import ComponentsList from './ComponentsList.svelte';
  import { fetchProjectComponents, firstTiles, matchingComponents, tileCount, type CanvasComponents } from '$lib/canvas/project-components';

  let { projectId }: { projectId: string } = $props();

  let canvases = $state<CanvasComponents[] | null>(null);
  let query = $state('');

  const PAGE_TILES = 24;

  let limit = $state(PAGE_TILES);
  let more = $state<HTMLElement | null>(null);

  const matching = $derived(matchingComponents(canvases ?? [], query));
  const shown = $derived(firstTiles(matching, limit));
  const hasMore = $derived(tileCount(matching) > limit);

  $effect(() => {
    void query;
    limit = PAGE_TILES;
  });

  $effect(() => {
    void limit;
    if (!more) {
      return;
    }
    const watch = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        limit += PAGE_TILES;
      }
    });
    watch.observe(more);
    return () => watch.disconnect();
  });

  $effect(() => {
    void fetchProjectComponents(projectId).then((found) => (canvases = found));
  });
</script>

<div class="project-components" data-testid="project-components">
  <label class="search">
    <Search size={14} />
    <input bind:value={query} placeholder="Search components" data-testid="components-search" onkeydown={(e) => e.stopPropagation()} />
  </label>

  {#if canvases === null}
    <p class="note">Loading…</p>
  {:else if !shown.length}
    <p class="note">{canvases.length ? 'No match' : 'No components in this project yet'}</p>
  {/if}

  {#each shown as canvas (canvas.canvasId)}
    <ComponentsList groups={canvas.components} title={canvas.canvasName} {projectId} canvasId={canvas.canvasId} />
  {/each}

  {#if hasMore}
    <div class="more" bind:this={more} data-testid="components-more"></div>
  {/if}
</div>

<style>
  .project-components {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .search {
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--ui-control-h);
    padding: 0 8px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text-secondary);
  }

  .search input {
    flex: 1 1 auto;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: inherit;
    font-size: var(--ui-type-body);
    color: var(--ui-text);
  }

  .more {
    height: 1px;
  }

  .note {
    margin: 0;
    padding: 8px;
    font-size: var(--ui-type-caption);
    color: var(--ui-text-tertiary);
  }
</style>
