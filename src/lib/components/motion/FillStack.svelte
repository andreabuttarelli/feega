<script lang="ts">
  import { BLEND_MODES } from '$lib/motion/blend';
  import { FILL_TYPES, FillType, IMAGE_FITS, addFill, addStop, moveFill, removeFill, removeStop, retypeFill, setFill, type Fill, type FillOf, type FillPatch, type Stop } from '$lib/motion/fill/model';

  type Asset = { id: string; kind: string; label: string; previewUrl: string };

  let { fills, assets, color, onchange }: { fills: Fill[]; assets: Asset[]; color: (value: string) => string; onchange: (fills: Fill[], summary: string) => void } = $props();

  const PERCENT = 100;
  const IMAGE = 'image';
  const HEX = /^#[0-9a-f]{6}$/i;

  const TYPE_LABEL: Record<FillType, string> = {
    [FillType.Solid]: 'Solid',
    [FillType.Linear]: 'Linear',
    [FillType.Radial]: 'Radial',
    [FillType.Image]: 'Image'
  };

  let open = $state<number | null>(null);
  let stopAt = $state(0);
  let dragged = $state<number | null>(null);

  const topFirst = $derived(fills.map((fill, index) => ({ fill, index })).reverse());
  const pct = (n: number) => Math.round(n * PERCENT);
  const hex = (value: string) => (HEX.test(color(value)) ? color(value) : '#000000');

  const stopCss = (stops: Stop[]) => [...stops].sort((a, b) => a.pos - b.pos).map((s) => `${color(s.color)} ${pct(s.pos)}%`).join(',');

  const SWATCH: Record<FillType, (f: Fill) => string> = {
    [FillType.Solid]: (f) => color((f as FillOf<FillType.Solid>).color),
    [FillType.Linear]: (f) => `linear-gradient(${(f as FillOf<FillType.Linear>).angle + 90}deg,${stopCss((f as FillOf<FillType.Linear>).stops)})`,
    [FillType.Radial]: (f) => `radial-gradient(circle,${stopCss((f as FillOf<FillType.Radial>).stops)})`,
    [FillType.Image]: (f) => {
      const preview = assets.find((a) => a.id === (f as FillOf<FillType.Image>).assetId)?.previewUrl ?? (f as FillOf<FillType.Image>).src;
      return preview ? `center / cover no-repeat url("${preview}")` : 'var(--ui-field)';
    }
  };

  const patch = (i: number, p: FillPatch, summary: string) => onchange(setFill(fills, i, p), summary);
  const percentOf = (e: Event) => Math.max(0, Math.min(PERCENT, Number((e.currentTarget as HTMLInputElement).value))) / PERCENT;

  function add() {
    onchange(addFill(fills, FillType.Solid), 'Add fill');
    open = fills.length;
  }

  function remove(i: number) {
    onchange(removeFill(fills, i), 'Remove fill');
    open = null;
  }

  function drop(to: number) {
    if (dragged === null || dragged === to) {
      dragged = null;
      return;
    }
    onchange(moveFill(fills, dragged, to), 'Reorder fills');
    dragged = null;
  }

  function stopsOf(i: number): Stop[] {
    return (fills[i] as FillOf<FillType.Linear>).stops;
  }

  function setStop(i: number, s: number, p: Partial<Stop>) {
    patch(i, { stops: stopsOf(i).map((stop, at) => (at === s ? { ...stop, ...p } : stop)) }, 'Edit gradient');
  }

  function barPos(e: MouseEvent): number {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return box.width ? Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) : 0;
  }

  function addStopAt(i: number, e: MouseEvent) {
    if (e.target !== e.currentTarget) {
      return;
    }
    const stops = addStop(stopsOf(i), Math.round(barPos(e) * PERCENT) / PERCENT);
    patch(i, { stops }, 'Add gradient stop');
    stopAt = stops.length - 1;
  }

  function dragStop(i: number, s: number, e: PointerEvent) {
    const bar = (e.currentTarget as HTMLElement).parentElement!;
    stopAt = s;
    let moved: number | null = null;
    const move = (m: PointerEvent) => {
      const box = bar.getBoundingClientRect();
      moved = box.width ? Math.max(0, Math.min(1, (m.clientX - box.left) / box.width)) : 0;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      if (moved !== null) {
        setStop(i, s, { pos: Math.round(moved * PERCENT) / PERCENT });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }
</script>

{#snippet eye(shown: boolean)}
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
    {#if !shown}<path d="M3 3l18 18" />{/if}
  </svg>
{/snippet}

<div class="fills" data-testid="fill-stack">
  <div class="head">
    <span class="title">Fill</span>
    <button type="button" class="icon" data-testid="fill-add" aria-label="Add fill" title="Add fill" onclick={add}>+</button>
  </div>

  {#each topFirst as { fill, index } (index)}
    <div
      class="row"
      class:off={!fill.visible}
      class:open={open === index}
      role="button"
      tabindex="0"
      draggable="true"
      data-testid="fill-row"
      data-index={index}
      onclick={() => (open = open === index ? null : index)}
      onkeydown={(e) => e.key === 'Enter' && (open = open === index ? null : index)}
      ondragstart={() => (dragged = index)}
      ondragover={(e) => e.preventDefault()}
      ondrop={(e) => {
        e.preventDefault();
        drop(index);
      }}
    >
      <span class="grip" aria-hidden="true">⋮⋮</span>
      <span class="swatch" style={`background:${SWATCH[fill.type](fill)}`}></span>
      <select data-testid="fill-type" aria-label="Fill type" value={fill.type} onclick={(e) => e.stopPropagation()} onchange={(e) => onchange(retypeFill(fills, index, e.currentTarget.value as FillType), 'Change fill type')}>
        {#each FILL_TYPES as type (type)}<option value={type}>{TYPE_LABEL[type]}</option>{/each}
      </select>
      <input class="pct" type="number" min="0" max="100" step="1" data-testid="fill-opacity" aria-label="Fill opacity" value={pct(fill.opacity)} onclick={(e) => e.stopPropagation()} onchange={(e) => patch(index, { opacity: percentOf(e) }, 'Fill opacity')} />
      <button type="button" class="icon" data-testid="fill-eye" aria-label={fill.visible ? 'Hide fill' : 'Show fill'} onclick={(e) => { e.stopPropagation(); patch(index, { visible: !fill.visible }, fill.visible ? 'Hide fill' : 'Show fill'); }}>
        {#if fill.visible}{@render eye(true)}{:else}{@render eye(false)}{/if}
      </button>
      <button type="button" class="icon" data-testid="fill-remove" aria-label="Remove fill" onclick={(e) => { e.stopPropagation(); remove(index); }}>−</button>
    </div>

    {#if open === index}
      <div class="editor" data-testid="fill-editor">
        {#if fill.type === FillType.Solid}
          <label class="field">Colour <input type="color" data-testid="fill-color" value={hex(fill.color)} onchange={(e) => patch(index, { color: e.currentTarget.value }, 'Fill colour')} /></label>
        {:else if fill.type === FillType.Linear || fill.type === FillType.Radial}
          {@const stop = fill.stops[Math.min(stopAt, fill.stops.length - 1)]}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="bar" data-testid="fill-bar" title="Click to add a stop" style={`background:linear-gradient(90deg,${stopCss(fill.stops)})`} onclick={(e) => addStopAt(index, e)}>
            {#each fill.stops as s, si (si)}
              <button type="button" class="stop" class:on={si === Math.min(stopAt, fill.stops.length - 1)} data-testid="fill-stop" aria-label={`Stop ${si + 1}`} style={`left:${pct(s.pos)}%;background:${color(s.color)}`} onclick={(e) => { e.stopPropagation(); stopAt = si; }} onpointerdown={(e) => dragStop(index, si, e)}></button>
            {/each}
          </div>
          <div class="field">
            Stop
            <span class="inline">
              <input type="color" data-testid="fill-stop-color" aria-label="Stop colour" value={hex(stop.color)} onchange={(e) => setStop(index, Math.min(stopAt, fill.stops.length - 1), { color: e.currentTarget.value })} />
              <input class="pct" type="number" min="0" max="100" aria-label="Stop position" value={pct(stop.pos)} onchange={(e) => setStop(index, Math.min(stopAt, fill.stops.length - 1), { pos: percentOf(e) })} />
              <button type="button" class="icon" aria-label="Remove stop" disabled={fill.stops.length <= 2} onclick={() => { patch(index, { stops: removeStop(fill.stops, Math.min(stopAt, fill.stops.length - 1)) }, 'Remove gradient stop'); stopAt = 0; }}>−</button>
            </span>
          </div>
          {#if fill.type === FillType.Linear}
            <label class="field">Angle <input type="number" min="-360" max="360" step="1" data-testid="fill-angle" value={fill.angle} onchange={(e) => patch(index, { angle: Number(e.currentTarget.value) }, 'Gradient angle')} /></label>
          {:else}
            <label class="field">Centre X <input type="range" min="0" max="1" step="0.01" value={fill.center.x} onchange={(e) => patch(index, { center: { ...fill.center, x: Number(e.currentTarget.value) } }, 'Gradient centre')} /></label>
            <label class="field">Centre Y <input type="range" min="0" max="1" step="0.01" value={fill.center.y} onchange={(e) => patch(index, { center: { ...fill.center, y: Number(e.currentTarget.value) } }, 'Gradient centre')} /></label>
            <label class="field">Radius <input type="range" min="0.05" max="4" step="0.01" data-testid="fill-radius" value={fill.radius} onchange={(e) => patch(index, { radius: Number(e.currentTarget.value) }, 'Gradient radius')} /></label>
          {/if}
        {:else}
          <div class="assets">
            {#each assets.filter((a) => a.kind === IMAGE) as asset (asset.id)}
              <button type="button" class="asset" class:on={fill.assetId === asset.id} data-testid="fill-asset" title={asset.label} onclick={() => patch(index, { assetId: asset.id, src: undefined }, 'Fill image')}><img src={asset.previewUrl} alt={asset.label} /></button>
            {:else}
              <span class="empty">No images in this project yet.</span>
            {/each}
          </div>
          <label class="field">Fit
            <select data-testid="fill-fit" value={fill.fit} onchange={(e) => patch(index, { fit: e.currentTarget.value }, 'Image fit')}>
              {#each IMAGE_FITS as fit (fit)}<option value={fit}>{fit}</option>{/each}
            </select>
          </label>
          <label class="field">Focus X <input type="range" min="0" max="1" step="0.01" data-testid="fill-focus-x" value={fill.focus.x} onchange={(e) => patch(index, { focus: { ...fill.focus, x: Number(e.currentTarget.value) } }, 'Image focus')} /></label>
          <label class="field">Focus Y <input type="range" min="0" max="1" step="0.01" data-testid="fill-focus-y" value={fill.focus.y} onchange={(e) => patch(index, { focus: { ...fill.focus, y: Number(e.currentTarget.value) } }, 'Image focus')} /></label>
          <label class="field">Scale <input type="range" min="0.1" max="4" step="0.05" data-testid="fill-scale" value={fill.scale} onchange={(e) => patch(index, { scale: Number(e.currentTarget.value) }, 'Image scale')} /></label>
        {/if}
        <label class="field">Blend
          <select data-testid="fill-blend" value={fill.blend} onchange={(e) => patch(index, { blend: e.currentTarget.value }, 'Fill blend')}>
            {#each BLEND_MODES as mode (mode)}<option value={mode}>{mode}</option>{/each}
          </select>
        </label>
      </div>
    {/if}
  {:else}
    <span class="empty">No fill. + adds one.</span>
  {/each}
</div>

<style>
  .fills {
    display: grid;
    gap: 2px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    font-size: var(--ui-text-sm, 11px);
    color: var(--ui-ink-2);
  }

  .row {
    display: grid;
    grid-template-columns: 12px 18px 1fr 44px 22px 22px;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    cursor: default;
  }

  .row.open {
    background: var(--ui-field);
  }

  .row.off .swatch,
  .row.off select,
  .row.off .pct {
    opacity: 0.4;
  }

  .grip {
    color: var(--ui-muted);
    cursor: grab;
    display: inline-flex;
  }

  .swatch {
    width: 18px;
    height: 18px;
    border: 1px solid var(--ui-line);
  }

  select,
  input[type='number'] {
    height: 22px;
    min-width: 0;
    padding: 0 4px;
    border: 1px solid transparent;
    border-radius: 0;
    background: var(--ui-field);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-sm, 11px);
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: var(--ui-ink-2);
  }

  .icon:hover {
    background: var(--ui-field);
  }

  .editor {
    display: grid;
    gap: 6px;
    padding: 6px 0 8px 16px;
  }

  .bar {
    position: relative;
    height: 16px;
    margin: 4px 7px 6px;
    border: 1px solid var(--ui-line);
    cursor: copy;
  }

  .stop {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    padding: 0;
    border: 2px solid #ffffff;
    border-radius: 9999px;
    box-shadow: 0 0 0 1px var(--ui-line);
    transform: translate(-50%, -50%);
    cursor: ew-resize;
  }

  .stop.on {
    box-shadow: 0 0 0 2px var(--ui-accent);
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    font-size: var(--ui-text-sm, 11px);
    color: var(--ui-ink-2);
  }

  .field select,
  .field input[type='range'] {
    width: 60%;
  }

  .inline {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  input[type='color'] {
    width: 28px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--ui-line);
    border-radius: 0;
    background: none;
  }

  .assets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .asset {
    aspect-ratio: 1;
    padding: 2px;
    overflow: hidden;
    border: 1px solid var(--ui-line);
    border-radius: 0;
    background: var(--ui-surface);
  }

  .asset img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .asset.on {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  .empty {
    grid-column: 1 / -1;
    font-size: var(--ui-text-sm, 11px);
    color: var(--ui-muted);
  }
</style>
