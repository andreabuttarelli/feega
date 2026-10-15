<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { FIELD_INPUT, FOCUS_RING, MENU_CONTENT, MENU_ITEM, SECTION_LABEL } from '$lib/components/ui/shell/styles';
  import { BLEND_MODES } from '$lib/motion/blend';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';
  import { FILL_LABEL, FILL_TYPES, FillType, IMAGE_FITS, addFill, addStop, colourAlpha, moveFill, removeFill, removeStop, retypeFill, setFill, withAlpha, type Fill, type FillOf, type FillPatch, type Stop } from '$lib/motion/fill/model';
  import ColorField from './ColorField.svelte';
  import { Adder } from './stack-adder';
  import SidePopover from '$lib/components/ui/shell/SidePopover.svelte';
  import MediaPicker from './MediaPicker.svelte';
  import type { MediaUploader } from './media-upload';
  import { MediaKind, type MediaPick } from '$lib/motion/media/pick';

  type Asset = { id: string; kind: string; label: string; previewUrl: string };

  let { fills, assets, tokens, title = '', adder = Adder.Own, upload = null, onchange }: { fills: Fill[]; assets: Asset[]; tokens: BrandTokens; title?: string; adder?: Adder; upload?: MediaUploader | null; onchange: (fills: Fill[], summary: string) => void } = $props();

  const PERCENT = 100;
  const ICON = cn('inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-ui-icon hover:bg-ui-wash hover:text-ui-text', FOCUS_RING);
  const LABEL = 'text-ui-label text-ui-text-2';
  const FIELD_ROW = 'flex items-center justify-between gap-2';

  const TYPE_LABEL = FILL_LABEL;

  const imagePick = (f: FillOf<FillType.Image>): MediaPick | null => (f.src ? { kind: MediaKind.Image, url: f.src } : f.assetId ? { kind: MediaKind.Image, assetId: f.assetId } : null);
  const IMAGE_PATCH = (pick: MediaPick | null): FillPatch => ({ assetId: pick?.assetId ?? '', src: pick?.url });

  let open = $state<number | null>(null);
  let adding = $state(false);
  let stopAt = $state(0);
  let dragged = $state<number | null>(null);
  let root = $state<HTMLDivElement | null>(null);
  let rowEls = $state<HTMLElement[]>([]);

  const topFirst = $derived(fills.map((fill, index) => ({ fill, index })).reverse());
  const pct = (n: number) => Math.round(n * PERCENT);
  const color = (value: string) => resolveColor(value, tokens);
  const stopCss = (stops: Stop[]) => [...stops].sort((a, b) => a.pos - b.pos).map((s) => `${color(s.color)} ${pct(s.pos)}%`).join(',');

  const SWATCH: Record<FillType, (f: Fill) => string> = {
    [FillType.Solid]: (f) => color((f as FillOf<FillType.Solid>).color),
    [FillType.Linear]: (f) => `linear-gradient(${(f as FillOf<FillType.Linear>).angle + 90}deg,${stopCss((f as FillOf<FillType.Linear>).stops)})`,
    [FillType.Radial]: (f) => `radial-gradient(circle,${stopCss((f as FillOf<FillType.Radial>).stops)})`,
    [FillType.Image]: (f) => {
      const preview = assets.find((a) => a.id === (f as FillOf<FillType.Image>).assetId)?.previewUrl ?? (f as FillOf<FillType.Image>).src;
      return preview ? `center / cover no-repeat url("${preview}")` : 'var(--ui-input)';
    }
  };

  const HEX_DIGITS = /^#/;
  const rowLabel = (f: Fill) => (f.type === FillType.Solid ? colourAlpha(f.color).base.replace(HEX_DIGITS, '').toUpperCase() : TYPE_LABEL[f.type]);

  const patch = (i: number, p: FillPatch, summary: string) => onchange(setFill(fills, i, p), summary);
  const percentOf = (e: Event) => Math.max(0, Math.min(PERCENT, Number((e.currentTarget as HTMLInputElement).value))) / PERCENT;
  const toggle = (i: number) => (open = open === i ? null : i);

  function add(type: FillType) {
    onchange(addFill(fills, type), 'Add fill');
    open = fills.length;
    adding = false;
  }

  function remove(i: number) {
    onchange(removeFill(fills, i), 'Remove fill');
    open = null;
  }

  function drop(to: number) {
    if (dragged !== null && dragged !== to) {
      onchange(moveFill(fills, dragged, to), 'Reorder fills');
    }
    dragged = null;
  }

  const stopsOf = (i: number): Stop[] => (fills[i] as FillOf<FillType.Linear>).stops;
  const setStop = (i: number, s: number, p: Partial<Stop>) => patch(i, { stops: stopsOf(i).map((stop, at) => (at === s ? { ...stop, ...p } : stop)) }, 'Edit gradient');
  const recolour = (value: string, alpha: number) => withAlpha(value, alpha, color);

  function addStopAt(i: number, e: MouseEvent) {
    if (e.target !== e.currentTarget) {
      return;
    }
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = box.width ? Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) : 0;
    const stops = addStop(stopsOf(i), Math.round(pos * PERCENT) / PERCENT);
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

{#snippet colour(name: string, value: string, write: (next: string) => void)}
  {@const { base, alpha } = colourAlpha(value)}
  <div class="flex min-w-0 items-center gap-1">
    <div class="min-w-0 flex-1"><ColorField {name} value={base} {tokens} onchange={(next) => write(recolour(next, alpha))} /></div>
    <input class={cn(FIELD_INPUT, 'w-12')} type="number" min="0" max="100" step="1" data-testid="fill-alpha" aria-label={`${name} alpha`} title="Alpha %" value={pct(alpha)} onchange={(e) => write(recolour(base, percentOf(e)))} />
  </div>
{/snippet}

<div class="flex flex-col gap-0.5" data-testid="fill-stack" bind:this={root}>
  {#if adder === Adder.Own}
  <div class="relative flex h-(--ui-row) items-center justify-between">
    <span class={SECTION_LABEL}>{title}</span>
    <button type="button" class={ICON} data-testid="fill-add" aria-label="Add fill" aria-expanded={adding} onclick={() => (adding = !adding)}>+</button>
    {#if adding}
      <div class={cn(MENU_CONTENT, 'absolute top-full right-0 min-w-36')} role="menu" data-testid="fill-add-menu">
        {#each FILL_TYPES as type (type)}
          <button type="button" role="menuitem" class={MENU_ITEM} data-testid={`fill-add-${type}`} onclick={() => add(type)}>{TYPE_LABEL[type]}</button>
        {/each}
      </div>
    {/if}
  </div>
  {/if}

  {#each topFirst as { fill, index } (index)}
    <div
      bind:this={rowEls[index]}
      class={cn('grid grid-cols-[10px_18px_minmax(0,1fr)_48px_24px_24px] items-center gap-1 rounded-sm px-0.5', open === index && 'bg-ui-selected', !fill.visible && '[&>.dim]:opacity-40')}
      role="button"
      tabindex="0"
      draggable="true"
      data-testid="fill-row"
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
      <button
        type="button"
        class={cn('dim size-[18px] rounded-xs border border-ui-divider p-0', FOCUS_RING)}
        data-testid="fill-swatch"
        aria-label={`Edit ${TYPE_LABEL[fill.type].toLowerCase()} fill`}
        aria-expanded={open === index}
        style={`background:${SWATCH[fill.type](fill)}`}
        onclick={(e) => {
          e.stopPropagation();
          toggle(index);
        }}
      ></button>
      <span class={cn(LABEL, 'dim truncate')} data-testid="fill-label">{rowLabel(fill)}</span>
      <input class={cn(FIELD_INPUT, 'dim')} type="number" min="0" max="100" step="1" data-testid="fill-opacity" aria-label="Layer opacity" title="Layer opacity %" value={pct(fill.opacity)} onclick={(e) => e.stopPropagation()} onchange={(e) => patch(index, { opacity: percentOf(e) }, 'Fill opacity')} />
      <button
        type="button"
        class={ICON}
        data-testid="fill-eye"
        aria-label={fill.visible ? 'Hide fill' : 'Show fill'}
        onclick={(e) => {
          e.stopPropagation();
          patch(index, { visible: !fill.visible }, fill.visible ? 'Hide fill' : 'Show fill');
        }}>{@render eye(fill.visible)}</button
      >
      <button
        type="button"
        class={ICON}
        data-testid="fill-remove"
        aria-label="Remove fill"
        onclick={(e) => {
          e.stopPropagation();
          remove(index);
        }}>−</button
      >
    </div>

    {#if open === index && rowEls[index]}
      <SidePopover anchor={rowEls[index]} within={root} key={String(index)} title={TYPE_LABEL[fill.type]} label={`${TYPE_LABEL[fill.type]} fill`} swatch={SWATCH[fill.type](fill)} onclose={() => (open = null)}>
      <div class="flex flex-col gap-1.5" data-testid="fill-editor">
        <label class={FIELD_ROW}
          ><span class={LABEL}>Type</span>
          <select class={cn(FIELD_INPUT, 'w-28')} data-testid="fill-type" aria-label="Fill type" value={fill.type} onchange={(e) => onchange(retypeFill(fills, index, e.currentTarget.value as FillType), 'Change fill type')}>
            {#each FILL_TYPES as type (type)}<option value={type}>{TYPE_LABEL[type]}</option>{/each}
          </select>
        </label>
        {#if fill.type === FillType.Solid}
          {@render colour('Fill colour', fill.color, (next) => patch(index, { color: next }, 'Fill colour'))}
        {:else if fill.type === FillType.Linear || fill.type === FillType.Radial}
          {@const at = Math.min(stopAt, fill.stops.length - 1)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="relative mx-2 my-1 h-4 cursor-copy rounded-xs border border-ui-divider" data-testid="fill-bar" title="Click to add a stop" style={`background:linear-gradient(90deg,${stopCss(fill.stops)})`} onclick={(e) => addStopAt(index, e)}>
            {#each fill.stops as s, si (si)}
              <button
                type="button"
                class={cn('absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white shadow-ui-float', si === at && 'ring-2 ring-ui-accent-solid')}
                data-testid="fill-stop"
                aria-label={`Stop ${si + 1}`}
                style={`left:${pct(s.pos)}%;background:${color(s.color)}`}
                onclick={(e) => {
                  e.stopPropagation();
                  stopAt = si;
                }}
                onpointerdown={(e) => dragStop(index, si, e)}
              ></button>
            {/each}
          </div>
          {@render colour(`Stop ${at + 1} colour`, fill.stops[at].color, (next) => setStop(index, at, { color: next }))}
          <div class={FIELD_ROW}>
            <span class={LABEL}>Position</span>
            <span class="flex items-center gap-1">
              <input class={cn(FIELD_INPUT, 'w-14')} type="number" min="0" max="100" aria-label="Stop position" value={pct(fill.stops[at].pos)} onchange={(e) => setStop(index, at, { pos: percentOf(e) })} />
              <button
                type="button"
                class={ICON}
                aria-label="Remove stop"
                disabled={fill.stops.length <= 2}
                onclick={() => {
                  patch(index, { stops: removeStop(fill.stops, at) }, 'Remove gradient stop');
                  stopAt = 0;
                }}>−</button
              >
            </span>
          </div>
          {#if fill.type === FillType.Linear}
            <label class={FIELD_ROW}><span class={LABEL}>Angle</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="-360" max="360" step="1" data-testid="fill-angle" value={fill.angle} onchange={(e) => patch(index, { angle: Number(e.currentTarget.value) }, 'Gradient angle')} /></label>
          {:else}
            <label class={FIELD_ROW}><span class={LABEL}>Centre X</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" value={pct(fill.center.x)} onchange={(e) => patch(index, { center: { ...fill.center, x: percentOf(e) } }, 'Gradient centre')} /></label>
            <label class={FIELD_ROW}><span class={LABEL}>Centre Y</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" value={pct(fill.center.y)} onchange={(e) => patch(index, { center: { ...fill.center, y: percentOf(e) } }, 'Gradient centre')} /></label>
            <label class={FIELD_ROW}><span class={LABEL}>Radius</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="1" max="400" step="1" data-testid="fill-radius" value={pct(fill.radius)} onchange={(e) => patch(index, { radius: Math.max(1, Number(e.currentTarget.value)) / PERCENT }, 'Gradient radius')} /></label>
          {/if}
        {:else}
          <MediaPicker label="Fill image" value={imagePick(fill)} {assets} uploader={upload} onpick={(pick) => patch(index, IMAGE_PATCH(pick), 'Fill image')} />
          <label class={FIELD_ROW}
            ><span class={LABEL}>Fit</span>
            <select class={cn(FIELD_INPUT, 'w-28')} data-testid="fill-fit" value={fill.fit} onchange={(e) => patch(index, { fit: e.currentTarget.value }, 'Image fit')}>
              {#each IMAGE_FITS as fit (fit)}<option value={fit}>{fit}</option>{/each}
            </select>
          </label>
          <label class={FIELD_ROW}><span class={LABEL}>Focus X</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" data-testid="fill-focus-x" value={pct(fill.focus.x)} onchange={(e) => patch(index, { focus: { ...fill.focus, x: percentOf(e) } }, 'Image focus')} /></label>
          <label class={FIELD_ROW}><span class={LABEL}>Focus Y</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" data-testid="fill-focus-y" value={pct(fill.focus.y)} onchange={(e) => patch(index, { focus: { ...fill.focus, y: percentOf(e) } }, 'Image focus')} /></label>
          <label class={FIELD_ROW}><span class={LABEL}>Scale</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="10" max="1000" step="5" data-testid="fill-scale" value={pct(fill.scale)} onchange={(e) => patch(index, { scale: Math.max(10, Number(e.currentTarget.value)) / PERCENT }, 'Image scale')} /></label>
        {/if}
        <label class={FIELD_ROW}
          ><span class={LABEL}>Blend</span>
          <select class={cn(FIELD_INPUT, 'w-28')} data-testid="fill-blend" value={fill.blend} onchange={(e) => patch(index, { blend: e.currentTarget.value }, 'Fill blend')}>
            {#each BLEND_MODES as mode (mode)}<option value={mode}>{mode}</option>{/each}
          </select>
        </label>
      </div>
      </SidePopover>
    {/if}
  {:else}
    <span class="text-ui-caption text-ui-text-3">No fill. + adds one.</span>
  {/each}
</div>
