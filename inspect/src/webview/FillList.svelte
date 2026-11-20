<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { Popover } from 'bits-ui';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import { FillKind, layerCss, newFill, type Fill, type Stop } from './fills';
  import { ImageSource, imageSaved, imageSource, readAsBase64 } from './image-file.svelte';
  import { toHost } from './host';
  import { ToHost } from '../messages';
  import { hexOf } from './colour';
  import { Section } from './controls';
  import ColorPicker from './ColorPicker.svelte';
  import ColourSwatch from './ColourSwatch.svelte';
  import type { Palette } from '../messages';

  const KINDS: { kind: FillKind; label: string }[] = [
    { kind: FillKind.Solid, label: 'Solid' },
    { kind: FillKind.Linear, label: 'Linear' },
    { kind: FillKind.Radial, label: 'Radial' },
    { kind: FillKind.Conic, label: 'Conic' },
    { kind: FillKind.Image, label: 'Image' }
  ];

  const SIZES = ['cover', 'contain', 'auto'];
  const REPEATS = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'];
  const POSITIONS: { label: string; value: string }[] = [
    { label: 'Top left', value: '0% 0%' },
    { label: 'Top', value: '50% 0%' },
    { label: 'Top right', value: '100% 0%' },
    { label: 'Left', value: '0% 50%' },
    { label: 'Center', value: '50% 50%' },
    { label: 'Right', value: '100% 50%' },
    { label: 'Bottom left', value: '0% 100%' },
    { label: 'Bottom', value: '50% 100%' },
    { label: 'Bottom right', value: '100% 100%' }
  ];

  type Props = {
    parse: () => Fill[];
    css: (fills: Fill[]) => Record<string, string>;
    guard?: (next: Fill[]) => string | null;
    onrefuse?: (reason: string) => void;
    scope?: string;
    inline?: boolean;
    header: Snippet<[Section, Snippet?, boolean?]>;
    row: Snippet<[string, Snippet, string?]>;
    onchange: (css: Record<string, string>) => void;
    onpreview: (css: Record<string, string>) => void;
    palette: Palette;
  };

  let { parse, css, guard, onrefuse, scope = 'fill', inline = false, header, row, onchange, onpreview, palette }: Props = $props();

  let fills = $state<Fill[]>([]);
  $effect(() => {
    fills = parse();
  });

  let choosing = $state<number | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();

  $effect(() => {
    const url = imageSaved.url;
    const at = untrack(() => choosing);
    if (!url || at === null) {
      return;
    }
    choosing = null;
    const fill = untrack(() => fills[at]);
    if (fill?.kind === FillKind.Image) {
      replace(at, { ...fill, url });
    }
  });

  function choose(i: number) {
    choosing = i;
    if (imageSource === ImageSource.Host) {
      toHost({ kind: ToHost.ImageChoose });
      return;
    }
    fileInput?.click();
  }

  async function uploaded(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) {
      choosing = null;
      return;
    }
    toHost({ kind: ToHost.ImageUpload, name: file.name, data: await readAsBase64(file) });
  }

  function commit(next: Fill[]) {
    const refusal = guard?.(next) ?? null;
    if (refusal) {
      onrefuse?.(refusal);
      fills = parse();
      return;
    }
    fills = next;
    onchange(css(next));
  }

  const swap = (i: number, fill: Fill) => fills.map((f, j) => (j === i ? fill : f));
  const replace = (i: number, fill: Fill) => commit(swap(i, fill));
  const peek = (i: number, fill: Fill) => onpreview(css(swap(i, fill)));
  const withStop = (fill: Fill, s: number, patch: Partial<Stop>) => ('stops' in fill ? { ...fill, stops: fill.stops.map((stop, k) => (k === s ? { ...stop, ...patch } : stop)) } : fill);
  const setStop = (i: number, s: number, patch: Partial<Stop>) => replace(i, withStop(fills[i], s, patch));
  const peekStop = (i: number, s: number, patch: Partial<Stop>) => peek(i, withStop(fills[i], s, patch));
  const labelOf = (f: Fill) => KINDS.find((k) => k.kind === f.kind)?.label ?? '';
  const valueOf = (f: Fill) => (f.kind === FillKind.Solid ? hexOf(f.colour) : f.kind === FillKind.Image ? f.url || 'image' : `${f.stops.length} stops`);
</script>

{#snippet add()}
  <button type="button" class="icon" title="Add fill" aria-label="Add fill" onclick={() => commit([newFill(FillKind.Solid), ...fills])}><Plus size={14} /></button>
{/snippet}

{@render header(Section.Fill, add, inline)}
{#each fills as fill, i (i)}
  {#snippet layer()}
    <div class="layer" class:off={!fill.visible} data-field="fill-layer">
      <Popover.Root>
        <Popover.Trigger class="swatch-button" aria-label="Edit fill">
          <span class="swatch" style={`background: ${layerCss(fill)}`}></span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content class="fill-popover" side="left" sideOffset={8} collisionPadding={8}>
            <header class="pop-head"><span>Fill</span></header>
            <select value={fill.kind} aria-label="Fill type" onchange={(e) => replace(i, newFill(e.currentTarget.value as FillKind))}>
              {#each KINDS as k (k.kind)}<option value={k.kind}>{k.label}</option>{/each}
            </select>
            {#if fill.kind === FillKind.Solid}
              <ColorPicker value={fill.colour} {palette} onchange={(p) => replace(i, { ...fill, colour: p.css })} onpreview={(c) => peek(i, { ...fill, colour: c })} />
            {:else if fill.kind === FillKind.Image}
              <button type="button" class="primary" data-field="choose-image" onclick={() => choose(i)}>Choose image</button>
              <label class="line">URL <input type="text" value={fill.url} placeholder="/image.png" onchange={(e) => replace(i, { ...fill, url: e.currentTarget.value })} /></label>
              <label class="line">Size
                <select value={fill.size} aria-label="Image size" onchange={(e) => replace(i, { ...fill, size: e.currentTarget.value })}>
                  {#if !SIZES.includes(fill.size)}<option value={fill.size}>{fill.size}</option>{/if}
                  {#each SIZES as size (size)}<option value={size}>{size}</option>{/each}
                </select>
              </label>
              <label class="line">Repeat
                <select value={fill.repeat} aria-label="Image repeat" onchange={(e) => replace(i, { ...fill, repeat: e.currentTarget.value })}>
                  {#if !REPEATS.includes(fill.repeat)}<option value={fill.repeat}>{fill.repeat}</option>{/if}
                  {#each REPEATS as repeat (repeat)}<option value={repeat}>{repeat}</option>{/each}
                </select>
              </label>
              <label class="line">Position
                <select value={fill.position} aria-label="Image position" onchange={(e) => replace(i, { ...fill, position: e.currentTarget.value })}>
                  {#if !POSITIONS.some((p) => p.value === fill.position)}<option value={fill.position}>{fill.position}</option>{/if}
                  {#each POSITIONS as p (p.value)}<option value={p.value}>{p.label}</option>{/each}
                </select>
              </label>
              <input bind:this={fileInput} type="file" accept="image/*" hidden aria-label="Image file" onchange={uploaded} />
            {:else}
              <div class="bar" style={`background: ${layerCss({ ...fill, kind: FillKind.Linear, angle: '90deg' } as Fill)}`}></div>
              {#if fill.kind === FillKind.Radial}
                <label class="line">Shape <input type="text" value={fill.shape} onchange={(e) => replace(i, { ...fill, shape: e.currentTarget.value })} /></label>
              {:else}
                <label class="line">Angle <input type="text" value={fill.angle} onchange={(e) => replace(i, { ...fill, angle: e.currentTarget.value })} /></label>
              {/if}
              {#each fill.stops as stop, s (s)}
                <div class="line">
                  <ColourSwatch value={stop.colour} {palette} label="Stop colour" onchange={(p) => setStop(i, s, { colour: p.css })} onpreview={(c) => peekStop(i, s, { colour: c })} />
                  <input type="text" class="at" value={stop.at} aria-label="Stop position" onchange={(e) => setStop(i, s, { at: e.currentTarget.value })} />
                  <button type="button" class="icon" aria-label="Remove stop" disabled={fill.stops.length <= 2} onclick={() => replace(i, { ...fill, stops: fill.stops.filter((_, k) => k !== s) })}><Minus size={12} /></button>
                </div>
              {/each}
              <button type="button" class="add-stop" onclick={() => replace(i, { ...fill, stops: [...fill.stops, { colour: '#888888', at: '50%' }] })}>Add stop</button>
            {/if}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {#if fill.kind === FillKind.Solid}
        <input type="text" class="hex" value={hexOf(fill.colour)} aria-label="Fill hex" onchange={(e) => replace(i, { ...fill, colour: e.currentTarget.value })} />
      {:else}
        <span class="hex">{valueOf(fill)}</span>
      {/if}
      <button type="button" class="icon" aria-label={fill.visible ? 'Hide' : 'Show'} title={fill.visible ? 'Hide' : 'Show'} onclick={() => replace(i, { ...fill, visible: !fill.visible })}>{#if fill.visible}<Eye size={14} />{:else}<EyeOff size={14} />{/if}</button>
      <button type="button" class="icon" aria-label="Remove fill" title="Remove" onclick={() => commit(fills.filter((_, j) => j !== i))}><Minus size={14} /></button>
    </div>
  {/snippet}
  {@render row(labelOf(fill), layer, `${scope}-${i}`)}
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

  .layer.off .hex,
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
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
  }

  .hex {
    flex: 1;
    min-width: 0;
    margin-left: 6px;
    overflow: hidden;
    border: 0;
    background: none;
    box-shadow: none !important;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    box-shadow: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .icon:hover {
    color: var(--ui-text);
  }

  .bar {
    height: 12px;
    border-radius: var(--ui-radius-xs);
  }

  :global(.fill-popover) {
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

  :global(.fill-popover) .pop-head {
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  :global(.fill-popover) select,
  :global(.fill-popover) input[type='text'] {
    flex: 1;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  .line {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .at {
    max-width: 64px;
  }

  .primary,
  .add-stop {
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }

  .primary {
    background: var(--ui-text);
    color: var(--ui-panel);
  }
</style>
