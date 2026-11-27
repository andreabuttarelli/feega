<script lang="ts">
  import type { ComponentRow } from '../host/component-list';
  import CanvasBanner from './CanvasBanner.svelte';
  import { groupComponents, keyOfComponent } from './components';
  import SearchField from './SearchField.svelte';

  type Props = { rows: ComponentRow[]; onopen: (row: ComponentRow) => void; oncanvas: () => void };

  let { rows, onopen, oncanvas }: Props = $props();

  let query = $state('');

  const groups = $derived(groupComponents(rows, query));
</script>

<div class="components" data-testid="components">
  <CanvasBanner hint="See every component side by side" testid="canvas-open-components" onopen={oncanvas} />
  <div class="search"><SearchField label="Search components" value={query} placeholder="Search components" onsearch={(text) => (query = text)} /></div>

  {#each groups as group (group.folder)}
    <section data-testid="component-group" data-folder={group.folder}>
      <h3>{group.folder || 'Top level'}</h3>
      <ul>
        {#each group.rows as row (keyOfComponent(row))}
          <li>
            <button type="button" class="component" title={`Open ${row.name} on its own`} data-testid="component-row" data-name={row.name} onclick={() => onopen(row)}>
              <span class="name">{row.name}</span>
              {#if row.uses > 0}<span class="uses" data-testid="component-uses" title={`Used in ${row.uses} ${row.uses === 1 ? 'file' : 'files'}`}>{row.uses}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="empty" data-testid="components-empty">{rows.length ? 'No component matches.' : 'No components found in this project.'}</p>
  {/each}
</div>

<style>
  .search {
    display: flex;
    padding: 0 8px 4px;
  }

  .search :global(input) {
    flex: 1;
  }

  h3 {
    margin: 0;
    padding: 8px 12px 2px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    font-weight: 500;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .component {
    display: flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    width: 100%;
    height: 26px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-sm);
    text-align: left;
    cursor: pointer;
  }

  .component:hover {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .uses {
    margin-left: auto;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    font-size: var(--ui-text-xs);
    font-variant-numeric: tabular-nums;
  }

  .empty {
    margin: 0;
    padding: 8px 12px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }
</style>
