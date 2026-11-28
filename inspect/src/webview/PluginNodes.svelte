<script lang="ts">
  import { Control, type UiNode } from '@feega/plugin-api/protocol';
  import type { Palette } from '../messages';
  import ColourSwatch from './ColourSwatch.svelte';
  import Field from './Field.svelte';
  import SearchField from './SearchField.svelte';

  type Props = { plugin: string; id: string; tree: UiNode[]; palette: Palette; onsend: (plugin: string, id: string, control: string, value: string | number | boolean, live: boolean) => void };

  let { plugin, id, tree, palette, onsend }: Props = $props();

  const maskOf = (image: string) => `url("data:image/svg+xml,${encodeURIComponent(image)}")`;
</script>

{#each tree as node, index (index)}
  {#if node.type === Control.Slider}
    <div class="row" data-control={node.id}>
      <span class="label">{node.label}</span>
      <div class="control">
        <input type="range" min={node.min} max={node.max} step={node.step} value={node.value} aria-label={node.label} oninput={(e) => onsend(plugin, id, node.id, Number(e.currentTarget.value), true)} onchange={(e) => onsend(plugin, id, node.id, Number(e.currentTarget.value), false)} />
        <Field name={node.label} px={node.value} min={node.min} max={node.max} onpreview={(v) => onsend(plugin, id, node.id, Number(v), true)} onchange={(v) => onsend(plugin, id, node.id, Number(v), false)} />
      </div>
    </div>
  {:else if node.type === Control.Colour}
    <div class="row" data-control={node.id}>
      <span class="label">{node.label}</span>
      <div class="control">
        <ColourSwatch value={node.value} {palette} label={node.label} onpreview={(css) => onsend(plugin, id, node.id, css, true)} onchange={(chosen) => onsend(plugin, id, node.id, chosen.css, false)} />
        <input class="hex" type="text" spellcheck="false" aria-label={`${node.label} hex`} value={node.value} onchange={(e) => onsend(plugin, id, node.id, e.currentTarget.value, false)} />
      </div>
    </div>
  {:else if node.type === Control.Toggle}
    <div class="row" data-control={node.id}>
      <span class="label">{node.label}</span>
      <div class="control"><input type="checkbox" checked={node.value} aria-label={node.label} onchange={(e) => onsend(plugin, id, node.id, e.currentTarget.checked, false)} /></div>
    </div>
  {:else if node.type === Control.Select}
    <div class="row" data-control={node.id}>
      <span class="label">{node.label}</span>
      <div class="control">
        <select value={node.value} aria-label={node.label} onchange={(e) => onsend(plugin, id, node.id, e.currentTarget.value, false)}>
          {#each node.options as option (option.value)}<option value={option.value} selected={option.value === node.value}>{option.label}</option>{/each}
        </select>
      </div>
    </div>
  {:else if node.type === Control.List}
    <div class="list" role="radiogroup" aria-label={node.label} data-control={node.id}>
      {#each node.items as item (item.id)}
        <button type="button" role="radio" aria-checked={item.id === node.selected} class:on={item.id === node.selected} data-item={item.id} onclick={() => onsend(plugin, id, node.id, item.id, false)}>
          {#if item.swatch}<span class="swatch" style={`background:${item.swatch}`}></span>{/if}{item.label}
        </button>
      {/each}
    </div>
  {:else if node.type === Control.Search}
    <div class="row wide" data-control={node.id}>
      <SearchField label={node.label} value={node.value} placeholder={node.placeholder} onsearch={(text) => onsend(plugin, id, node.id, text, true)} />
    </div>
  {:else if node.type === Control.Grid}
    <div class="grid" role="radiogroup" aria-label={node.label} data-control={node.id}>
      {#each node.items as item (item.id)}
        <button type="button" role="radio" aria-checked={item.id === node.selected} aria-label={item.label} title={item.label} class:on={item.id === node.selected} data-item={item.id} onclick={() => onsend(plugin, id, node.id, item.id, false)}>
          {#if item.image}<span class="glyph" style={`mask-image:${maskOf(item.image)}`}></span>{:else if item.swatch}<span class="tile" style={`background:${item.swatch}`}></span>{/if}
        </button>
      {/each}
    </div>
  {:else if node.type === Control.Button}
    <div class="row wide" data-control={node.id}>
      <button type="button" class="action" onclick={() => onsend(plugin, id, node.id, true, false)}>{node.label}</button>
    </div>
  {:else}
    <p class="note">{node.text}</p>
  {/if}
{/each}

<style>
  .row {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 4px 12px;
  }

  .row.wide {
    grid-template-columns: minmax(0, 1fr);
  }

  .label {
    overflow: hidden;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .control {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .control :global(.field) {
    flex: 0 0 64px;
  }

  input[type='range'] {
    flex: 1;
    min-width: 0;
    accent-color: var(--ui-accent);
  }

  select,
  .hex {
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background-color: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  select {
    flex: 1;
    min-width: 0;
  }

  .hex {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    font-family: ui-monospace, monospace;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px 12px 6px;
  }

  .list button {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .list button:hover {
    background: var(--ui-input);
  }

  .list button.on {
    background: color-mix(in srgb, var(--ui-accent) 20%, transparent);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
    gap: 4px;
    max-height: 264px;
    padding: 2px 12px 6px;
    overflow-y: auto;
  }

  .grid button {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    cursor: pointer;
  }

  .grid button:hover {
    background: var(--ui-input-hover);
  }

  .grid button.on {
    background: color-mix(in srgb, var(--ui-accent) 28%, transparent);
    outline: 1px solid var(--ui-accent);
  }

  .glyph {
    width: 20px;
    height: 20px;
    background-color: var(--ui-text);
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
  }

  .tile {
    width: 100%;
    height: 100%;
    border-radius: inherit;
  }

  .swatch {
    width: 14px;
    height: 14px;
    border: 1px solid var(--ui-line-strong);
    border-radius: var(--ui-radius-full);
  }

  .action {
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }

  .action:hover {
    background: var(--ui-input-hover);
  }

  .note {
    margin: 0;
    padding: 4px 12px 8px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }
</style>
