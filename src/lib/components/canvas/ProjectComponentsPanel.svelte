<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import ComponentsList from './ComponentsList.svelte';
  import { fetchProjectComponents, matchingComponents, type CanvasComponents } from '$lib/canvas/project-components';

  let { projectId }: { projectId: string } = $props();

  let canvases = $state<CanvasComponents[] | null>(null);
  let query = $state('');

  const shown = $derived(matchingComponents(canvases ?? [], query));

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

  .note {
    margin: 0;
    padding: 8px;
    font-size: var(--ui-type-caption);
    color: var(--ui-text-tertiary);
  }
</style>
