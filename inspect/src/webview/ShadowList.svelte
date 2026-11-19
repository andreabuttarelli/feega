<script lang="ts">
  import { Popover } from 'bits-ui';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import NumberField from '@feega/properties-panel/NumberField.svelte';
  import { NEW_SHADOW, parseShadows, shadowCss, type Shadow } from './shadows';
  import { hexOf } from './colour';

  const PRESETS: Record<string, string> = {
    sm: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
    md: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 8px 10px -6px rgba(0, 0, 0, 0.1)'
  };
  const FIELDS: { key: 'x' | 'y' | 'blur' | 'spread'; label: string; min: number }[] = [
    { key: 'x', label: 'X', min: -200 },
    { key: 'y', label: 'Y', min: -200 },
    { key: 'blur', label: 'Blur', min: 0 },
    { key: 'spread', label: 'Spread', min: -200 }
  ];
  const RANGE_MAX = 200;

  let { css, label, onchange }: { css: string; label: string; onchange: (css: string) => void } = $props();

  let layers = $state<Shadow[]>([]);
  $effect(() => {
    layers = parseShadows(css);
  });

  function commit(next: Shadow[]) {
    layers = next;
    onchange(shadowCss(next));
  }

  const update = (i: number, patch: Partial<Shadow>) => commit(layers.map((s, j) => (j === i ? { ...s, ...patch } : s)));
</script>

<div class="list" data-field={`${label.toLowerCase()}-shadows`}>
  <div class="head">
    <span>{label}</span>
    <select aria-label={`${label} presets`} onchange={(e) => (commit(parseShadows(PRESETS[e.currentTarget.value])), (e.currentTarget.value = ''))}>
      <option value="">Presets</option>
      {#each Object.keys(PRESETS) as name (name)}<option value={name}>{name}</option>{/each}
    </select>
    <button type="button" class="icon" title={`Add ${label.toLowerCase()} shadow`} aria-label={`Add ${label.toLowerCase()} shadow`} onclick={() => commit([...layers, NEW_SHADOW])}><Plus size={14} /></button>
  </div>
  {#each layers as layer, i (i)}
    <div class="row">
      <Popover.Root>
        <Popover.Trigger class="swatch-trigger" aria-label="Edit shadow">
          <span class="swatch" style={`box-shadow: ${layer.inset ? 'inset ' : ''}${Math.sign(layer.x) * 2}px ${Math.sign(layer.y) * 2}px 4px ${layer.colour}`}></span>
          <span>{layer.inset ? 'Inner' : 'Drop'}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content class="shadow-popover" sideOffset={6} side="left">
            <div class="fields">
              {#each FIELDS as f (f.key)}
                <NumberField label={f.label} name={`shadow-${f.key}`} value={layer[f.key]} range={{ min: f.min, max: RANGE_MAX, step: 1 }} unit="px" onchange={(v) => update(i, { [f.key]: v })} />
              {/each}
            </div>
            <label class="line">Colour <input type="color" value={hexOf(layer.colour)} onchange={(e) => update(i, { colour: e.currentTarget.value })} /></label>
            <label class="line">Inner <input type="checkbox" checked={layer.inset} onchange={(e) => update(i, { inset: e.currentTarget.checked })} /></label>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <button type="button" class="icon" aria-label={layer.visible ? 'Hide' : 'Show'} title={layer.visible ? 'Hide' : 'Show'} onclick={() => update(i, { visible: !layer.visible })}>{#if layer.visible}<Eye size={14} />{:else}<EyeOff size={14} />{/if}</button>
      <button type="button" class="icon" aria-label="Remove" title="Remove" onclick={() => commit(layers.filter((_, j) => j !== i))}><Minus size={14} /></button>
    </div>
  {/each}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    grid-column: span 2;
  }

  .head,
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    font-size: var(--ui-text-xs);
    color: var(--ui-text-2);
  }

  .head span {
    flex: 1;
  }

  .head select {
    height: 22px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  .row :global(.swatch-trigger) {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .swatch {
    width: 14px;
    height: 14px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-panel);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .icon:hover {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  :global(.shadow-popover) {
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 220px;
    padding: 12px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 12px 32px rgb(0 0 0 / 0.28);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
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
