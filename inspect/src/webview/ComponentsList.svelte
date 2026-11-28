<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import type { ComponentRow } from '../host/component-list';
  import ActionBanner from './ActionBanner.svelte';
  import { bestExample } from './component-props';
  import { isPreset } from './edge-presets';
  import type { ExampleProps } from './component-props.svelte';
  import { exampleLabel, keyOfComponent } from './components';
  import { NodeKind, buildTree, highlight, visibleNodes } from './components-tree';
  import { freshKeys } from './fresh-keys.svelte';
  import { ICON_SVG, LayerIcon } from './layer-icons';
  import PropFields from './PropFields.svelte';
  import SearchField from './SearchField.svelte';
  import './tree-rows.css';

  type Props = { rows: ComponentRow[]; props: ExampleProps; open: string[]; onopen: (row: ComponentRow) => void; onfolders: (open: string[]) => void; oncanvas?: () => void };

  let { rows, props, open, onopen, onfolders, oncanvas }: Props = $props();

  const INDENT_PX = 12;

  let query = $state('');
  let tree = $state<HTMLElement>();
  let expanded = $state<string[]>([]);

  const searching = $derived(query.trim() !== '');
  const opened = $derived(new Set(open));
  const shown = $derived(visibleNodes(buildTree(rows, query), opened, searching));
  const fresh = freshKeys(() => rows.map(keyOfComponent));

  const treeRows = () => [...(tree?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
  const focusId = (id: string | null) => treeRows().find((el) => el.dataset.node === id)?.focus();
  const expandable = (row: ComponentRow) => row.examples.length > 0 || props.fieldsOf(row).length > 0;
  const toggleDetail = (id: string) => (expanded = expanded.includes(id) ? expanded.filter((k) => k !== id) : [...expanded, id]);
  const isOpen = (id: string) => searching || opened.has(id);
  const setOpen = (id: string, on: boolean) => onfolders(on ? [...new Set([...open, id])] : open.filter((o) => o !== id));

  function onKey(e: KeyboardEvent, at: (typeof shown)[number]) {
    const { node } = at;
    const list = treeRows();
    const index = list.indexOf(e.currentTarget as HTMLElement);
    const folder = node.kind === NodeKind.Folder;
    const actions: Record<string, () => void> = {
      ArrowUp: () => list[index - 1]?.focus(),
      ArrowDown: () => list[index + 1]?.focus(),
      ArrowRight: () => (folder ? (isOpen(node.id) ? list[index + 1]?.focus() : setOpen(node.id, true)) : undefined),
      ArrowLeft: () => (folder && isOpen(node.id) && !searching ? setOpen(node.id, false) : focusId(at.parent)),
      Enter: () => (folder ? setOpen(node.id, !isOpen(node.id)) : onopen(node.row)),
      ' ': () => (folder ? setOpen(node.id, !isOpen(node.id)) : onopen(node.row))
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  }
</script>

{#snippet marked(text: string)}
  {@const part = highlight(text, query)}
  {part.before}{#if part.hit}<mark data-testid="component-match">{part.hit}</mark>{/if}{part.after}
{/snippet}

{#snippet glyph(icon: LayerIcon)}
  <svg class="tree-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="0.833" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html ICON_SVG[icon]}</svg>
{/snippet}

<div class="components" data-testid="components">
  {#if oncanvas}<ActionBanner testid="canvas-open-components" onopen={oncanvas} />{/if}
  <div class="search"><SearchField label="Search components" value={query} placeholder="Search components" onsearch={(text) => (query = text)} /></div>

  {#if shown.length}
    <div role="tree" aria-label="Components" bind:this={tree}>
      {#each shown as at (at.node.id)}
        {@const node = at.node}
        {#if node.kind === NodeKind.Folder}
          <div
            class="tree-row"
            role="treeitem"
            aria-selected="false"
            aria-expanded={isOpen(node.id)}
            tabindex="0"
            style={`padding-left:${8 + at.depth * INDENT_PX}px`}
            data-node={node.id}
            data-testid="component-folder"
            data-folder={node.id}
            onclick={() => setOpen(node.id, !isOpen(node.id))}
            onkeydown={(e) => onKey(e, at)}
          >
            <button type="button" class="tree-twist" class:open={isOpen(node.id)} tabindex="-1" aria-label={isOpen(node.id) ? 'Collapse' : 'Expand'} onclick={(e) => (e.stopPropagation(), setOpen(node.id, !isOpen(node.id)))}><ChevronRight size={12} /></button>
            {@render glyph(LayerIcon.Folder)}
            <span class="tree-name">{@render marked(node.label)}</span>
          </div>
        {:else}
          <div
            class="tree-row component"
            class:fresh={fresh.has(node.id)}
            role="treeitem"
            aria-selected="false"
            tabindex="0"
            style={`padding-left:${8 + at.depth * INDENT_PX}px`}
            title={`Open ${node.row.name} on its own`}
            data-node={node.id}
            data-testid="component-row"
            data-name={node.row.name}
            onclick={() => onopen(node.row)}
            onkeydown={(e) => onKey(e, at)}
          >
            {#if expandable(node.row)}
              <button type="button" class="tree-twist" class:open={expanded.includes(node.id)} tabindex="-1" aria-label={expanded.includes(node.id) ? 'Hide examples' : 'Show examples'} data-testid="component-expand" onclick={(e) => (e.stopPropagation(), toggleDetail(node.id))}><ChevronRight size={12} /></button>
            {:else}
              <span class="tree-twist"></span>
            {/if}
            {@render glyph(LayerIcon.Component)}
            <span class="tree-name">{@render marked(node.row.name)}</span>
            {#if node.row.uses > 0}<span class="uses" data-testid="component-uses" title={`Used in ${node.row.uses} ${node.row.uses === 1 ? 'file' : 'files'}`}>{node.row.uses}</span>{/if}
          </div>
          {#if expanded.includes(node.id)}
            <div class="detail" role="group" style={`padding-left:${8 + (at.depth + 1) * INDENT_PX}px`} data-testid="component-detail">
              {#each node.row.examples as example (example.id)}
                <button type="button" class="example" class:on={!isPreset(props.chosenOf(node.row)) && bestExample(node.row, props.chosenOf(node.row))?.id === example.id} title={`${example.file}:${example.line}`} data-testid="component-example" data-id={example.id} onclick={() => props.choose(node.row, example.id)}>{exampleLabel(example)}{#if example.unresolved.length > 0}<span class="rest">{example.unresolved.length} open</span>{/if}</button>
              {/each}
              {#each props.presetsOf(node.row) as preset (preset.id)}
                <button type="button" class="example" class:on={props.chosenOf(node.row) === preset.id} data-testid="component-preset" data-id={preset.id} onclick={() => props.choose(node.row, preset.id)}>{preset.label}<span class="rest">edge</span></button>
              {/each}
              <PropFields fields={props.fieldsOf(node.row)} onedit={(name, text, kind) => props.edit(node.row, name, text, kind)} />
            </div>
          {/if}
        {/if}
      {/each}
    </div>
  {:else}
    <p class="empty" data-testid="components-empty">{rows.length ? 'No component matches.' : 'No components found in this project.'}</p>
  {/if}
</div>

<style>
  .search {
    display: flex;
    padding: 0 8px 4px;
  }

  .search :global(input) {
    flex: 1;
  }

  .component {
    cursor: pointer;
  }

  .component.fresh {
    animation: flash 2.5s ease-out;
  }

  @keyframes flash {
    from {
      background: color-mix(in srgb, var(--ui-accent) 35%, transparent);
    }
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 2px;
    padding-right: 12px;
    padding-bottom: 6px;
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

  mark {
    background: color-mix(in srgb, var(--ui-accent) 35%, transparent);
    color: inherit;
    border-radius: var(--ui-radius-xs);
  }

  .uses {
    margin-left: auto;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text-2);
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
