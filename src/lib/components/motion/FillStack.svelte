<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { FIELD_INPUT, FOCUS_RING, MENU_CONTENT, MENU_ITEM, SECTION_LABEL } from '$lib/components/ui/shell/styles';
  import { BLEND_MODES } from '@feega/motion-core/motion/blend';
  import { resolveColor, type BrandTokens } from '@feega/motion-core/motion/brand';
  import { FILL_LABEL, FILL_TYPES, FillType, IMAGE_CONTROLS, IMAGE_FITS, IMAGE_FIT_LABEL, ImageControl, addFill, cropOf, addStop, colourAlpha, moveFill, removeFill, removeStop, retypeFill, setFill, withAlpha, type Fill, type FillOf, type FillPatch, type Stop } from '@feega/motion-core/motion/fill/model';
  import ColorField from './ColorField.svelte';
  import { SliderField } from '$lib/components/ui/control';
  import { ADJUSTMENTS, ADJUSTMENT_LABEL, isNeutral, type Adjustment } from '@feega/motion-core/motion/fill/adjust';
  import type { LiveGesture } from '$lib/motion/live-edit';
  import { Adder } from './stack-adder';
  import { FillField, fillKey } from '@feega/motion-core/motion/fill/keys';
  import { KeyMark } from '$lib/motion/timeline-layers';
  import { stopCss, swatchOf } from '$lib/motion/fill/swatch';
  import SidePopover from '$lib/components/ui/shell/SidePopover.svelte';
  import MediaPicker from './MediaPicker.svelte';
  import type { MediaUploader } from './media-upload';
  import { MediaKind, type MediaPick } from '$lib/motion/media/pick';

  type Asset = { id: string; kind: string; label: string; previewUrl: string };
  type Keys = { mark: (key: string) => KeyMark; toggle: (key: string) => void };

  let { fills, assets, tokens, title = '', adder = Adder.Own, upload = null, gesture = null, keys = null, oncrop = null, onchange }: { oncrop?: (() => void) | null; keys?: Keys | null; gesture?: LiveGesture | null; fills: Fill[]; assets: Asset[]; tokens: BrandTokens; title?: string; adder?: Adder; upload?: MediaUploader | null; onchange: (fills: Fill[], summary: string) => void } = $props();

  const PERCENT = 100;
  const setAdjust = (i: number, current: FillOf<FillType.Image>, key: Adjustment, value: number) => patch(i, { adjust: { ...current.adjust, [key]: value / PERCENT } }, 'Image adjustment');
  const CROP_SIDES = ['x', 'y', 'w', 'h'] as const;
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
  const swatch = (fill: Fill) => swatchOf(fill, { color, picture: (f) => assets.find((a) => a.id === f.assetId)?.previewUrl ?? f.src });

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

{#snippet diamond(key: string)}
  {#if keys}
    <button type="button" class={cn('relative inline-flex h-6 w-4 shrink-0 items-center justify-center before:size-[5px] before:rotate-45 before:border before:border-ui-accent-solid before:content-[""]', FOCUS_RING, keys.mark(key) === KeyMark.None ? 'before:opacity-50 hover:before:opacity-100' : keys.mark(key) === KeyMark.Here ? 'before:bg-ui-accent-solid' : 'before:bg-ui-accent-solid/50')} data-testid="fill-key" data-key={key} data-mark={keys.mark(key)} title="Keyframe at playhead" aria-label={`Keyframe ${key}`} aria-pressed={keys.mark(key) === KeyMark.Here} onclick={() => keys.toggle(key)}></button>
  {/if}
{/snippet}

{#snippet colour(name: string, value: string, write: (next: string) => void, key: string | null = null)}
  {@const { base, alpha } = colourAlpha(value)}
  <div class="flex min-w-0 items-center gap-1">
    {#if key}{@render diamond(key)}{/if}
    <div class="min-w-0 flex-1"><ColorField {name} {gesture} value={base} {tokens} onchange={(next, typedAlpha) => write(recolour(next, typedAlpha ?? alpha))} /></div>
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
      class={cn('grid grid-cols-[10px_18px_minmax(0,1fr)_56px_24px_24px] items-center gap-1 rounded-sm px-0.5', open === index && 'bg-ui-selected', !fill.visible && '[&>.dim]:opacity-40')}
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
        style={`background:${swatch(fill)}`}
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
      <SidePopover anchor={rowEls[index]} within={root} key={String(index)} title={TYPE_LABEL[fill.type]} label={`${TYPE_LABEL[fill.type]} fill`} swatch={swatch(fill)} onclose={() => (open = null)}>
      <div class="flex flex-col gap-1.5" data-testid="fill-editor">
        <label class={FIELD_ROW}
          ><span class={LABEL}>Type</span>
          <select class={cn(FIELD_INPUT, 'w-28')} data-testid="fill-type" aria-label="Fill type" value={fill.type} onchange={(e) => onchange(retypeFill(fills, index, e.currentTarget.value as FillType), 'Change fill type')}>
            {#each FILL_TYPES as type (type)}<option value={type}>{TYPE_LABEL[type]}</option>{/each}
          </select>
        </label>
        {#if fill.type === FillType.Solid}
          {@render colour('Fill colour', fill.color, (next) => patch(index, { color: next }, 'Fill colour'), fillKey(index, FillField.Colour))}
        {:else if fill.type !== FillType.Image}
          {@const at = Math.min(stopAt, fill.stops.length - 1)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="relative mx-2 my-1 h-4 cursor-copy rounded-xs border border-ui-divider" data-testid="fill-bar" title="Click to add a stop" style={`background:linear-gradient(90deg,${stopCss(fill.stops, color)})`} onclick={(e) => addStopAt(index, e)}>
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
          {@render colour(`Stop ${at + 1} colour`, fill.stops[at].color, (next) => setStop(index, at, { color: next }), fillKey(index, FillField.StopColor, at))}
          <div class={FIELD_ROW}>
            <span class={LABEL}>Position</span>
            <span class="flex items-center gap-1">
              {@render diamond(fillKey(index, FillField.StopPos, at))}
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
            <label class={FIELD_ROW}><span class={LABEL}>Angle</span><span class="flex items-center gap-1">{@render diamond(fillKey(index, FillField.Angle))}<input class={cn(FIELD_INPUT, 'w-16')} type="number" min="-360" max="360" step="1" data-testid="fill-angle" value={fill.angle} onchange={(e) => patch(index, { angle: Number(e.currentTarget.value) }, 'Gradient angle')} /></span></label>
          {:else if fill.type === FillType.Angular}
            <label class={FIELD_ROW}><span class={LABEL}>Angle</span><span class="flex items-center gap-1">{@render diamond(fillKey(index, FillField.Angle))}<input class={cn(FIELD_INPUT, 'w-16')} type="number" min="-360" max="360" step="1" data-testid="fill-angle" value={fill.angle} onchange={(e) => patch(index, { angle: Number(e.currentTarget.value) }, 'Gradient angle')} /></span></label>
            <label class={FIELD_ROW}><span class={LABEL}>Centre X</span><span class="flex items-center gap-1">{@render diamond(fillKey(index, FillField.CentreX))}<input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" value={pct(fill.center.x)} onchange={(e) => patch(index, { center: { ...fill.center, x: percentOf(e) } }, 'Gradient centre')} /></span></label>
            <label class={FIELD_ROW}><span class={LABEL}>Centre Y</span><span class="flex items-center gap-1">{@render diamond(fillKey(index, FillField.CentreY))}<input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" value={pct(fill.center.y)} onchange={(e) => patch(index, { center: { ...fill.center, y: percentOf(e) } }, 'Gradient centre')} /></span></label>
          {:else if fill.type === FillType.Radial}
            <label class={FIELD_ROW}><span class={LABEL}>Centre X</span><span class="flex items-center gap-1">{@render diamond(fillKey(index, FillField.CentreX))}<input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" value={pct(fill.center.x)} onchange={(e) => patch(index, { center: { ...fill.center, x: percentOf(e) } }, 'Gradient centre')} /></span></label>
            <label class={FIELD_ROW}><span class={LABEL}>Centre Y</span><span class="flex items-center gap-1">{@render diamond(fillKey(index, FillField.CentreY))}<input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" value={pct(fill.center.y)} onchange={(e) => patch(index, { center: { ...fill.center, y: percentOf(e) } }, 'Gradient centre')} /></span></label>
            <label class={FIELD_ROW}><span class={LABEL}>Radius</span><span class="flex items-center gap-1">{@render diamond(fillKey(index, FillField.Radius))}<input class={cn(FIELD_INPUT, 'w-16')} type="number" min="1" max="400" step="1" data-testid="fill-radius" value={pct(fill.radius)} onchange={(e) => patch(index, { radius: Math.max(1, Number(e.currentTarget.value)) / PERCENT }, 'Gradient radius')} /></span></label>
          {/if}
        {:else}
          <MediaPicker label="Fill image" value={imagePick(fill)} {assets} uploader={upload} onpick={(pick) => patch(index, IMAGE_PATCH(pick), 'Fill image')} />
          <label class={FIELD_ROW}
            ><span class={LABEL}>Fit</span>
            <select class={cn(FIELD_INPUT, 'w-28')} data-testid="fill-fit" value={fill.fit} onchange={(e) => patch(index, { fit: e.currentTarget.value }, 'Image fit')}>
              {#each IMAGE_FITS as fit (fit)}<option value={fit}>{IMAGE_FIT_LABEL[fit]}</option>{/each}
            </select>
          </label>
          {#if oncrop}
            <button type="button" class={cn(MENU_ITEM, 'justify-center')} data-testid="fill-crop-edit" onclick={oncrop}>Crop image</button>
          {/if}
          {@const controls = IMAGE_CONTROLS[fill.fit]}
          {#if controls.includes(ImageControl.Focus)}
            <label class={FIELD_ROW}><span class={LABEL}>{controls.includes(ImageControl.Tile) ? 'Offset X' : 'Focus X'}</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" data-testid="fill-focus-x" value={pct(fill.focus.x)} onchange={(e) => patch(index, { focus: { ...fill.focus, x: percentOf(e) } }, 'Image focus')} /></label>
            <label class={FIELD_ROW}><span class={LABEL}>{controls.includes(ImageControl.Tile) ? 'Offset Y' : 'Focus Y'}</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" data-testid="fill-focus-y" value={pct(fill.focus.y)} onchange={(e) => patch(index, { focus: { ...fill.focus, y: percentOf(e) } }, 'Image focus')} /></label>
          {/if}
          {#if controls.includes(ImageControl.Zoom) || controls.includes(ImageControl.Tile)}
            <label class={FIELD_ROW}><span class={LABEL}>Scale</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="10" max="1000" step="5" data-testid="fill-scale" value={pct(fill.scale)} onchange={(e) => patch(index, { scale: Math.max(10, Number(e.currentTarget.value)) / PERCENT }, 'Image scale')} /></label>
          {/if}
          {#if controls.includes(ImageControl.Tile)}
            <label class={FIELD_ROW}><span class={LABEL}>Rotation</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="-360" max="360" step="1" data-testid="fill-rotation" value={fill.rotation ?? 0} onchange={(e) => patch(index, { rotation: Number(e.currentTarget.value) }, 'Tile rotation')} /></label>
          {/if}
          {#if controls.includes(ImageControl.Crop)}
            {#each CROP_SIDES as side (side)}
              <label class={FIELD_ROW}><span class={LABEL}>Crop {side.toUpperCase()}</span><input class={cn(FIELD_INPUT, 'w-16')} type="number" min="0" max="100" data-testid="fill-crop-{side}" value={pct(cropOf(fill)[side])} onchange={(e) => patch(index, { crop: { ...cropOf(fill), [side]: percentOf(e) } }, 'Image crop')} /></label>
            {/each}
          {/if}
          {#each ADJUSTMENTS as key (key)}
            <div class="flex flex-col gap-1" data-testid="fill-adjust-{key}">
              <span class={LABEL}>{ADJUSTMENT_LABEL[key]}</span>
              <SliderField label={ADJUSTMENT_LABEL[key]} value={pct(fill.adjust?.[key] ?? 0)} min={-PERCENT} max={PERCENT} onchange={(v) => setAdjust(index, fill, key, Number(v))} />
            </div>
          {/each}
          {#if !isNeutral(fill.adjust)}
            <button type="button" class={cn(MENU_ITEM, 'justify-center')} data-testid="fill-adjust-reset" onclick={() => patch(index, { adjust: undefined }, 'Reset image adjustments')}>Reset adjustments</button>
          {/if}
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
