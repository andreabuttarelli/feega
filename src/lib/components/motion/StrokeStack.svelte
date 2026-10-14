<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { FIELD_INPUT, FOCUS_RING, SECTION_LABEL } from '$lib/components/ui/shell/styles';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';
  import { FILL_TYPES, FillType, colourAlpha, retypeFill, withAlpha, type Fill, type Stop } from '$lib/motion/fill/model';
  import { CAPS, JOINS } from '$lib/motion/shape/schema';
  import { STROKE_ALIGNS, StrokeAlign, addStroke, moveStroke, removeStroke, setStroke, type Stroke, type StrokePatch } from '$lib/motion/stroke/model';
  import ColorField from './ColorField.svelte';
  import { Adder } from './stack-adder';
  import SidePopover from '$lib/components/ui/shell/SidePopover.svelte';

  let { strokes, tokens, sided = false, short, title = '', adder = Adder.Own, onchange }: { strokes: Stroke[]; tokens: BrandTokens; sided?: boolean; short: number; title?: string; adder?: Adder; onchange: (strokes: Stroke[], summary: string) => void } = $props();

  const PERCENT = 100;
  const PX_DIGITS = 10;
  const SIDE_NAMES = ['top', 'right', 'bottom', 'left'] as const;
  const ICON = cn('inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-ui-icon hover:bg-ui-wash hover:text-ui-text', FOCUS_RING);
  const LABEL = 'text-ui-label text-ui-text-2';
  const FIELD_ROW = 'flex items-center justify-between gap-2';
  const PAINTS = FILL_TYPES.filter((t) => t !== FillType.Image);

  const PAINT_LABEL: Record<string, string> = {
    [FillType.Solid]: 'Solid',
    [FillType.Linear]: 'Linear',
    [FillType.Radial]: 'Radial'
  };

  const ALIGN_LABEL: Record<StrokeAlign, string> = {
    [StrokeAlign.Inside]: 'Inside',
    [StrokeAlign.Center]: 'Center',
    [StrokeAlign.Outside]: 'Outside'
  };

  let open = $state<number | null>(null);
  let dragged = $state<number | null>(null);
  let root = $state<HTMLDivElement | null>(null);
  let rowEls = $state<HTMLElement[]>([]);

  const topFirst = $derived(strokes.map((stroke, index) => ({ stroke, index })).reverse());
  const color = (value: string) => resolveColor(value, tokens);
  const toPx = (n: number) => Math.round(n * short * PX_DIGITS) / PX_DIGITS;
  const fromPx = (e: Event) => Math.max(0, Number((e.currentTarget as HTMLInputElement).value)) / short;
  const stopCss = (stops: Stop[]) => [...stops].sort((a, b) => a.pos - b.pos).map((s) => `${color(s.color)} ${Math.round(s.pos * PERCENT)}%`).join(',');
  const swatch = (f: Fill) => (f.type === FillType.Solid ? color(f.color) : f.type === FillType.Image ? 'var(--ui-input)' : `linear-gradient(90deg,${stopCss(f.stops)})`);

  const rowLabel = (f: Fill) => (f.type === FillType.Solid ? colourAlpha(f.color).base.replace('#', '').toUpperCase() : PAINT_LABEL[f.type]);

  const patch = (i: number, p: StrokePatch, summary: string) => onchange(setStroke(strokes, i, p), summary);
  const repaint = (i: number, p: Partial<Record<string, unknown>>, summary: string) => patch(i, { paint: { ...strokes[i].paint, ...p } }, summary);
  const toggle = (i: number) => (open = open === i ? null : i);

  function add() {
    onchange(addStroke(strokes), 'Add stroke');
    open = strokes.length;
  }

  function remove(i: number) {
    onchange(removeStroke(strokes, i), 'Remove stroke');
    open = null;
  }

  function drop(to: number) {
    if (dragged !== null && dragged !== to) {
      onchange(moveStroke(strokes, dragged, to), 'Reorder strokes');
    }
    dragged = null;
  }

  const retype = (i: number, type: FillType) => patch(i, { paint: retypeFill([strokes[i].paint], 0, type)[0] }, 'Change stroke paint');
  const setSide = (i: number, side: number, e: Event) => patch(i, { sides: strokes[i].sides!.map((w, at) => (at === side ? fromPx(e) : w)) }, 'Stroke side width');
  const toggleSides = (i: number) => patch(i, { sides: strokes[i].sides ? undefined : SIDE_NAMES.map(() => strokes[i].width) }, 'Per-side stroke');
  const recolour = (value: string, alpha: number) => withAlpha(value, alpha, color);
</script>

{#snippet eye(shown: boolean)}
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
    {#if !shown}<path d="M3 3l18 18" />{/if}
  </svg>
{/snippet}

{#snippet colour(name: string, value: string, write: (next: string) => void)}
  {@const { base, alpha } = colourAlpha(value)}
  <ColorField {name} value={base} {tokens} {alpha} onchange={(next) => write(recolour(next, alpha))} onalpha={(next) => write(recolour(base, next))} />
{/snippet}

<div class="flex flex-col gap-0.5" data-testid="stroke-stack" bind:this={root}>
  {#if adder === Adder.Own}
    <div class="flex h-(--ui-row) items-center justify-between">
      <span class={SECTION_LABEL}>{title}</span>
      <button type="button" class={ICON} data-testid="stroke-add" aria-label="Add stroke" onclick={add}>+</button>
    </div>
  {/if}

  {#each topFirst as { stroke, index } (index)}
    <div
      bind:this={rowEls[index]}
      class={cn('grid grid-cols-[10px_18px_minmax(0,1fr)_56px_24px_24px] items-center gap-1 rounded-sm px-0.5', open === index && 'bg-ui-selected', !stroke.visible && '[&>.dim]:opacity-40')}
      role="button"
      tabindex="0"
      draggable="true"
      data-testid="stroke-row"
      data-index={index}
      data-open={open === index ? 'true' : undefined}
      onclick={() => toggle(index)}
      onkeydown={(e) => e.key === 'Enter' && toggle(index)}
      ondragstart={() => (dragged = index)}
      ondragover={(e) => e.preventDefault()}
      ondrop={(e) => {
        e.preventDefault();
        drop(index);
      }}
    >
      <span class="cursor-grab text-ui-text-3 select-none" aria-hidden="true">⋮</span>
      <span class="dim size-[18px] rounded-xs border border-ui-divider" data-testid="stroke-swatch" style={`background:${swatch(stroke.paint)}`}></span>
      <span class={cn(LABEL, 'dim truncate')} data-testid="stroke-label">{rowLabel(stroke.paint)}</span>
      <input class={cn(FIELD_INPUT, 'dim')} type="number" min="0" step="0.5" data-testid="stroke-width" aria-label="Stroke width px" title="Width px" value={toPx(stroke.width)} onclick={(e) => e.stopPropagation()} onchange={(e) => patch(index, { width: fromPx(e) }, 'Stroke width')} />
      <button
        type="button"
        class={ICON}
        data-testid="stroke-eye"
        aria-label={stroke.visible ? 'Hide stroke' : 'Show stroke'}
        onclick={(e) => {
          e.stopPropagation();
          patch(index, { visible: !stroke.visible }, stroke.visible ? 'Hide stroke' : 'Show stroke');
        }}>{@render eye(stroke.visible)}</button
      >
      <button
        type="button"
        class={ICON}
        data-testid="stroke-remove"
        aria-label="Remove stroke"
        onclick={(e) => {
          e.stopPropagation();
          remove(index);
        }}>−</button
      >
    </div>

    {#if open === index && rowEls[index]}
      <SidePopover anchor={rowEls[index]} within={root} key={String(index)} title={PAINT_LABEL[stroke.paint.type]} label={`${PAINT_LABEL[stroke.paint.type]} stroke`} swatch={swatch(stroke.paint)} onclose={() => (open = null)}>
      <div class="flex flex-col gap-1.5" data-testid="stroke-editor">
        <label class={FIELD_ROW}
          ><span class={LABEL}>Paint</span>
          <select class={cn(FIELD_INPUT, 'w-28')} data-testid="stroke-paint" value={stroke.paint.type} onchange={(e) => retype(index, e.currentTarget.value as FillType)}>
            {#each PAINTS as type (type)}<option value={type}>{PAINT_LABEL[type]}</option>{/each}
          </select>
        </label>
        {#if stroke.paint.type === FillType.Solid}
          {@render colour('Stroke colour', stroke.paint.color, (next) => repaint(index, { color: next }, 'Stroke colour'))}
        {:else if stroke.paint.type === FillType.Linear || stroke.paint.type === FillType.Radial}
          {@const stops = stroke.paint.stops}
          {#each stops as s, si (si)}
            {@render colour(`Stop ${si + 1} colour`, s.color, (next) => repaint(index, { stops: stops.map((x, at) => (at === si ? { ...x, color: next } : x)) }, 'Stroke gradient'))}
          {/each}
          {#if stroke.paint.type === FillType.Linear}
            <label class={FIELD_ROW}><span class={LABEL}>Angle</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="-360" max="360" step="1" data-testid="stroke-angle" value={stroke.paint.angle} onchange={(e) => repaint(index, { angle: Number(e.currentTarget.value) }, 'Stroke gradient angle')} /></label>
          {/if}
        {/if}
        <label class={FIELD_ROW}
          ><span class={LABEL}>Position</span>
          <select class={cn(FIELD_INPUT, 'w-28')} data-testid="stroke-align" value={stroke.align} onchange={(e) => patch(index, { align: e.currentTarget.value }, 'Stroke position')}>
            {#each STROKE_ALIGNS as align (align)}<option value={align}>{ALIGN_LABEL[align]}</option>{/each}
          </select>
        </label>
        <label class={FIELD_ROW}><span class={LABEL}>Dash</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" step="1" data-testid="stroke-dash" value={toPx(stroke.dash)} onchange={(e) => patch(index, { dash: fromPx(e) }, 'Stroke dash')} /></label>
        <label class={FIELD_ROW}><span class={LABEL}>Gap</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" step="1" data-testid="stroke-gap" value={toPx(stroke.gap)} onchange={(e) => patch(index, { gap: fromPx(e) }, 'Stroke gap')} /></label>
        <label class={FIELD_ROW}
          ><span class={LABEL}>Cap</span>
          <select class={cn(FIELD_INPUT, 'w-28')} data-testid="stroke-cap" value={stroke.cap} onchange={(e) => patch(index, { cap: e.currentTarget.value }, 'Stroke cap')}>
            {#each CAPS as cap (cap)}<option value={cap}>{cap}</option>{/each}
          </select>
        </label>
        <label class={FIELD_ROW}
          ><span class={LABEL}>Join</span>
          <select class={cn(FIELD_INPUT, 'w-28')} data-testid="stroke-join" value={stroke.join} onchange={(e) => patch(index, { join: e.currentTarget.value }, 'Stroke join')}>
            {#each JOINS as join (join)}<option value={join}>{join}</option>{/each}
          </select>
        </label>
        {#if sided}
          <label class={FIELD_ROW}><span class={LABEL}>Per side</span><input type="checkbox" data-testid="stroke-sides" checked={!!stroke.sides} onclick={() => toggleSides(index)} /></label>
          {#if stroke.sides}
            <div class="grid grid-cols-4 gap-1">
              {#each SIDE_NAMES as side, si (side)}
                <input class={FIELD_INPUT} type="number" min="0" step="0.5" data-testid={`stroke-side-${side}`} aria-label={`${side} width px`} title={side} value={toPx(stroke.sides[si])} onchange={(e) => setSide(index, si, e)} />
              {/each}
            </div>
          {/if}
        {/if}
      </div>
      </SidePopover>
    {/if}
  {:else}
    <span class="text-ui-caption text-ui-text-3">No stroke. + adds one.</span>
  {/each}
</div>
