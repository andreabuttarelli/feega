<script lang="ts">
  import { Popover } from 'bits-ui';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import { FillKind, fillCss, layerCss, newFill, parseFills, type Fill, type Stop } from './fills';
  import { hexOf } from './colour';

  const KINDS: { kind: FillKind; label: string }[] = [
    { kind: FillKind.Solid, label: 'Solid' },
    { kind: FillKind.Linear, label: 'Linear' },
    { kind: FillKind.Radial, label: 'Radial' },
    { kind: FillKind.Conic, label: 'Conic' },
    { kind: FillKind.Image, label: 'Image' }
  ];

  let { image, colour, onchange }: { image: string; colour: string; onchange: (css: Record<string, string>) => void } = $props();

  let fills = $state<Fill[]>([]);
  $effect(() => {
    fills = parseFills(image, colour);
  });

  function commit(next: Fill[]) {
    fills = next;
    onchange(fillCss(next));
  }

  const replace = (i: number, fill: Fill) => commit(fills.map((f, j) => (j === i ? fill : f)));
  const setStop = (i: number, s: number, patch: Partial<Stop>) => {
    const fill = fills[i];
    if ('stops' in fill) {
      replace(i, { ...fill, stops: fill.stops.map((stop, k) => (k === s ? { ...stop, ...patch } : stop)) });
    }
  };
</script>

<div class="list" data-field="fills">
  <div class="head">
    <span>Fill</span>
    <button type="button" class="icon" title="Add fill" aria-label="Add fill" onclick={() => commit([newFill(FillKind.Solid), ...fills])}><Plus size={14} /></button>
  </div>
  {#if !fills.length}<p class="none">None</p>{/if}
  {#each fills as fill, i (i)}
    <div class="row">
      <Popover.Root>
        <Popover.Trigger class="fill-trigger" aria-label="Edit fill">
          <span class="swatch" style={`background: ${layerCss(fill)}`}></span>
          <span>{KINDS.find((k) => k.kind === fill.kind)?.label}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content class="fill-popover" side="left" sideOffset={6}>
            <select value={fill.kind} aria-label="Fill type" onchange={(e) => replace(i, newFill(e.currentTarget.value as FillKind))}>
              {#each KINDS as k (k.kind)}<option value={k.kind}>{k.label}</option>{/each}
            </select>
            {#if fill.kind === FillKind.Solid}
              <label class="line">Colour <input type="color" value={hexOf(fill.colour)} onchange={(e) => replace(i, { ...fill, colour: e.currentTarget.value })} /></label>
            {:else if fill.kind === FillKind.Image}
              <label class="line">URL <input type="text" value={fill.url} placeholder="/image.png" onchange={(e) => replace(i, { ...fill, url: e.currentTarget.value })} /></label>
            {:else}
              <div class="bar" style={`background: ${layerCss({ ...fill, kind: FillKind.Linear, angle: '90deg' } as Fill)}`}></div>
              {#if fill.kind === FillKind.Radial}
                <label class="line">Shape <input type="text" value={fill.shape} onchange={(e) => replace(i, { ...fill, shape: e.currentTarget.value })} /></label>
              {:else}
                <label class="line">Angle <input type="text" value={fill.angle} onchange={(e) => replace(i, { ...fill, angle: e.currentTarget.value })} /></label>
              {/if}
              {#each fill.stops as stop, s (s)}
                <div class="line">
                  <input type="color" value={hexOf(stop.colour)} aria-label="Stop colour" onchange={(e) => setStop(i, s, { colour: e.currentTarget.value })} />
                  <input type="text" class="at" value={stop.at} aria-label="Stop position" onchange={(e) => setStop(i, s, { at: e.currentTarget.value })} />
                  <button type="button" class="icon" aria-label="Remove stop" disabled={fill.stops.length <= 2} onclick={() => replace(i, { ...fill, stops: fill.stops.filter((_, k) => k !== s) })}><Minus size={12} /></button>
                </div>
              {/each}
              <button type="button" class="add-stop" onclick={() => replace(i, { ...fill, stops: [...fill.stops, { colour: '#888888', at: '50%' }] })}>Add stop</button>
            {/if}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <button type="button" class="icon" aria-label={fill.visible ? 'Hide' : 'Show'} title={fill.visible ? 'Hide' : 'Show'} onclick={() => replace(i, { ...fill, visible: !fill.visible })}>{#if fill.visible}<Eye size={14} />{:else}<EyeOff size={14} />{/if}</button>
      <button type="button" class="icon" aria-label="Remove fill" title="Remove" onclick={() => commit(fills.filter((_, j) => j !== i))}><Minus size={14} /></button>
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
  .row,
  .line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    font-size: var(--ui-text-xs);
    color: var(--ui-text-2);
  }

  .head span {
    flex: 1;
  }

  .none {
    margin: 0;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .row :global(.fill-trigger) {
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
    box-shadow: 0 0 0 1px var(--ui-divider);
  }

  .bar {
    height: 12px;
    border-radius: var(--ui-radius-xs);
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

  :global(.fill-popover) {
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 240px;
    padding: 12px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 12px 32px rgb(0 0 0 / 0.28);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  :global(.fill-popover) select,
  :global(.fill-popover) input[type='text'] {
    flex: 1;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  .at {
    max-width: 64px;
  }

  .add-stop {
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }
</style>
