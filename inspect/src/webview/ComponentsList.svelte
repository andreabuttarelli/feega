<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import type { ComponentRow } from '../host/component-list';
  import ActionBanner from './ActionBanner.svelte';
  import { bestExample } from './component-props';
  import type { ExampleProps } from './component-props.svelte';
  import { exampleLabel, groupComponents, keyOfComponent } from './components';
  import { freshKeys } from './fresh-keys.svelte';
  import PropFields from './PropFields.svelte';
  import SearchField from './SearchField.svelte';

  type Props = { rows: ComponentRow[]; props: ExampleProps; onopen: (row: ComponentRow) => void; oncanvas: () => void };

  let { rows, props, onopen, oncanvas }: Props = $props();

  let query = $state('');
  let expanded = $state<string[]>([]);

  const expandable = (row: ComponentRow) => row.examples.length > 0 || props.fieldsOf(row).length > 0;
  const toggle = (key: string) => (expanded = expanded.includes(key) ? expanded.filter((k) => k !== key) : [...expanded, key]);

  const groups = $derived(groupComponents(rows, query));
  const fresh = freshKeys(() => rows.map(keyOfComponent));
</script>

<div class="components" data-testid="components">
  <ActionBanner hint="See every component side by side" testid="canvas-open-components" onopen={oncanvas} />
  <div class="search"><SearchField label="Search components" value={query} placeholder="Search components" onsearch={(text) => (query = text)} /></div>

  {#each groups as group (group.folder)}
    <section data-testid="component-group" data-folder={group.folder}>
      <h3>{group.folder || 'Top level'}</h3>
      <ul>
        {#each group.rows as row (keyOfComponent(row))}
          {@const key = keyOfComponent(row)}
          <li>
            <button type="button" class="component" class:fresh={fresh.has(keyOfComponent(row))} title={`Open ${row.name} on its own`} data-testid="component-row" data-name={row.name} onclick={() => onopen(row)}>
              {#if expandable(row)}<span class="chevron" role="button" tabindex="-1" aria-label={expanded.includes(key) ? 'Hide examples' : 'Show examples'} data-testid="component-expand" onclick={(e) => (e.stopPropagation(), toggle(key))} onkeydown={() => undefined}>{#if expanded.includes(key)}<ChevronDown size={12} />{:else}<ChevronRight size={12} />{/if}</span>{/if}
              <span class="name">{row.name}</span>
              {#if row.uses > 0}<span class="uses" data-testid="component-uses" title={`Used in ${row.uses} ${row.uses === 1 ? 'file' : 'files'}`}>{row.uses}</span>{/if}
            </button>
            {#if expanded.includes(key)}
              <div class="detail" data-testid="component-detail">
                {#each row.examples as example (example.id)}
                  <button type="button" class="example" class:on={bestExample(row, props.chosenOf(row))?.id === example.id} title={`${example.file}:${example.line}`} data-testid="component-example" data-id={example.id} onclick={() => props.choose(row, example.id)}>{exampleLabel(example)}{#if example.unresolved.length > 0}<span class="rest">{example.unresolved.length} open</span>{/if}</button>
                {/each}
                <PropFields fields={props.fieldsOf(row)} onedit={(name, text, kind) => props.edit(row, name, text, kind)} />
              </div>
            {/if}
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

  .component.fresh {
    animation: flash 2.5s ease-out;
  }

  @keyframes flash {
    from {
      background: color-mix(in srgb, var(--ui-accent) 35%, transparent);
    }
  }

  .chevron {
    display: grid;
    place-items: center;
    width: 14px;
    margin-left: -8px;
    color: var(--ui-text-2);
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px 12px 6px 28px;
  }

  .example {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 22px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    text-align: left;
    cursor: pointer;
  }

  .example:hover {
    background: var(--ui-input);
  }

  .example.on {
    color: var(--ui-text);
    background: var(--ui-input);
  }

  .rest {
    margin-left: auto;
    opacity: 0.7;
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
