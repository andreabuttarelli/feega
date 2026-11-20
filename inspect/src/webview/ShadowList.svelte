<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Popover, DropdownMenu } from 'bits-ui';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import Field from './Field.svelte';
  import ColourSwatch from './ColourSwatch.svelte';
  import type { Palette } from '../messages';
  import { NEW_SHADOW, parseShadows, shadowCss, type Shadow } from './shadows';
  import { Section } from './controls';

  const PRESETS: Record<string, string> = {
    Small: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
    Medium: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
    Large: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)',
    'Extra large': '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 8px 10px -6px rgba(0, 0, 0, 0.1)'
  };
  const FIELDS: { key: 'x' | 'y' | 'blur' | 'spread'; label: string; min: number }[] = [
    { key: 'x', label: 'X', min: -200 },
    { key: 'y', label: 'Y', min: -200 },
    { key: 'blur', label: 'B', min: 0 },
    { key: 'spread', label: 'S', min: -200 }
  ];

  type Props = {
    css: string;
    text: string | null;
    header: Snippet<[Section, Snippet?]>;
    row: Snippet<[string, Snippet, string?]>;
    onchange: (css: string) => void;
    ontext: (css: string) => void;
    onpreview: (css: string) => void;
    onpreviewtext: (css: string) => void;
    palette: Palette;
  };

  let { css, text, header, row, onchange, ontext, onpreview, onpreviewtext, palette }: Props = $props();

  let layers = $state<Shadow[]>([]);
  let textLayers = $state<Shadow[]>([]);
  $effect(() => {
    layers = parseShadows(css);
    textLayers = parseShadows(text ?? 'none');
  });

  function commit(next: Shadow[]) {
    layers = next;
    onchange(shadowCss(next));
  }

  function commitText(next: Shadow[]) {
    textLayers = next;
    ontext(textCss(next));
  }

  const textCss = (next: Shadow[]) => shadowCss(next).replace(/(^|, )inset /g, '$1');
  const peek = (next: Shadow[]) => onpreview(shadowCss(next));
  const peekText = (next: Shadow[]) => onpreviewtext(textCss(next));

  const update = (list: Shadow[], save: (n: Shadow[]) => void, i: number, patch: Partial<Shadow>) => save(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
</script>

{#snippet add()}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger class="icon-trigger" aria-label="Add effect" title="Add effect"><Plus size={14} /></DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content class="dropdown-menu" sideOffset={4} align="end">
        <DropdownMenu.Item class="dropdown-item" onSelect={() => commit([...layers, NEW_SHADOW])}>Drop shadow</DropdownMenu.Item>
        <DropdownMenu.Item class="dropdown-item" onSelect={() => commit([...layers, { ...NEW_SHADOW, inset: true }])}>Inner shadow</DropdownMenu.Item>
        {#if text !== null}<DropdownMenu.Item class="dropdown-item" onSelect={() => commitText([...textLayers, { ...NEW_SHADOW, spread: 0 }])}>Text shadow</DropdownMenu.Item>{/if}
        <DropdownMenu.Separator class="dropdown-sep" />
        {#each Object.entries(PRESETS) as [name, value] (name)}
          <DropdownMenu.Item class="dropdown-item" onSelect={() => commit(parseShadows(value))}>{name} shadow</DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
{/snippet}

{#snippet layerRow(list: Shadow[], save: (n: Shadow[]) => void, show: (n: Shadow[]) => void, layer: Shadow, i: number)}
  <div class="layer" class:off={!layer.visible} data-field="shadow-layer">
    <Popover.Root>
      <Popover.Trigger class="swatch-button" aria-label="Edit shadow">
        <span class="swatch" style={`box-shadow: ${layer.inset ? 'inset ' : ''}0 1px 3px ${layer.colour}, inset 0 0 0 1px rgb(0 0 0 / 0.2)`}></span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="shadow-popover" side="left" sideOffset={8} collisionPadding={8}>
          <header class="pop-head">{layer.inset ? 'Inner shadow' : 'Drop shadow'}</header>
          <div class="fields">
            {#each FIELDS as f (f.key)}
              <Field name={`shadow-${f.key}`} prefix={f.label} px={layer[f.key]} unit="px" min={f.min} max={200} onpreview={(v) => update(list, show, i, { [f.key]: parseFloat(v) })} onchange={(v) => update(list, save, i, { [f.key]: parseFloat(v) })} />
            {/each}
          </div>
          <div class="line">Colour <ColourSwatch value={layer.colour} {palette} label="Shadow colour" onchange={(p) => update(list, save, i, { colour: p.css })} onpreview={(c) => update(list, show, i, { colour: c })} /></div>
          <label class="line">Inner <input type="checkbox" checked={layer.inset} onchange={(e) => update(list, save, i, { inset: e.currentTarget.checked })} /></label>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
    <span class="value">{layer.x} {layer.y} {layer.blur} {layer.spread}</span>
    <button type="button" class="icon" aria-label={layer.visible ? 'Hide' : 'Show'} title={layer.visible ? 'Hide' : 'Show'} onclick={() => update(list, save, i, { visible: !layer.visible })}>{#if layer.visible}<Eye size={14} />{:else}<EyeOff size={14} />{/if}</button>
    <button type="button" class="icon" aria-label="Remove" title="Remove" onclick={() => save(list.filter((_, j) => j !== i))}><Minus size={14} /></button>
  </div>
{/snippet}

{@render header(Section.Effects, add)}
{#each layers as layer, i (i)}
  {#snippet one()}{@render layerRow(layers, commit, peek, layer, i)}{/snippet}
  {@render row(layer.inset ? 'Inner' : 'Drop', one, `shadow-${i}`)}
{/each}
{#each textLayers as layer, i (i)}
  {#snippet one()}{@render layerRow(textLayers, commitText, peekText, layer, i)}{/snippet}
  {@render row('Text', one, `text-shadow-${i}`)}
{/each}

<style>
  .layer {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 2px;
    min-width: 0;
    height: 28px;
    padding: 0 0 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .layer.off .value,
  .layer.off .swatch {
    opacity: 0.4;
  }

  .layer :global(.swatch-button) {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .swatch {
    width: 16px;
    height: 16px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-panel);
  }

  .value {
    flex: 1;
    min-width: 0;
    margin-left: 6px;
    overflow: hidden;
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon,
  :global(.icon-trigger) {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .icon:hover,
  :global(.icon-trigger:hover) {
    color: var(--ui-text);
  }

  :global(.shadow-popover),
  :global(.dropdown-menu) {
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 248px;
    padding: 12px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 12px 32px rgb(0 0 0 / 0.28);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  :global(.dropdown-menu) {
    gap: 0;
    width: 200px;
    padding: 4px;
    border-radius: var(--ui-radius-md);
  }

  :global(.dropdown-item) {
    padding: 6px 8px;
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    outline: none;
  }

  :global(.dropdown-item[data-highlighted]) {
    background: var(--ui-input);
  }

  :global(.dropdown-sep) {
    height: 1px;
    margin: 4px 0;
    background: var(--ui-divider);
  }

  .pop-head {
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .line {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
