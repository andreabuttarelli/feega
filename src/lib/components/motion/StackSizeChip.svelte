<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Check from '@lucide/svelte/icons/check';
  import { FOCUS_RING, MENU_CONTENT, MENU_ITEM } from '$lib/components/ui/shell';
  import { cn } from '$lib/utils.js';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { Sizing } from '@feega/motion-core/motion/layout/auto-layout';
  import { DEFAULT_LAYOUT_ITEM, MAX_LAYOUT_PX } from '@feega/motion-core/motion/layout/model';
  import { MAX_PERCENT } from '@feega/motion-core/motion/layout/size-entry';
  import { BOUNDS, Bound, formatLimit, limitOf, limitPatch, parseLimit, type LimitAxis } from '@feega/motion-core/motion/layout/limits';
  import { laidClip, setChildSize, setLayoutItem } from '$lib/motion/layout/ops';
  import NumberField from './NumberField.svelte';

  let { doc, clip, axis, sizings, commit }: { doc: MotionDoc; clip: MotionClip; axis: LimitAxis; sizings: readonly Sizing[]; commit: (result: OpResult, summary: string) => void } = $props();

  const AXIS_NAME: Record<LimitAxis, { label: string; short: string }> = { width: { label: 'Width', short: 'W' }, height: { label: 'Height', short: 'H' } };
  const SIZING_LABEL: Record<Sizing, string> = { [Sizing.Fixed]: 'Fixed', [Sizing.Hug]: 'Hug', [Sizing.Fill]: 'Fill', [Sizing.Percent]: '%' };
  const BOUND_LABEL: Record<Bound, string> = { [Bound.Min]: 'Min', [Bound.Max]: 'Max' };
  const PERCENT_KEY: Record<LimitAxis, 'widthPercent' | 'heightPercent'> = { width: 'widthPercent', height: 'heightPercent' };
  const PX_RANGE = { min: 0, max: MAX_LAYOUT_PX, step: 1 };
  const PERCENT_RANGE = { min: 1, max: MAX_PERCENT, step: 1 };

  const name = $derived(AXIS_NAME[axis]);
  const item = $derived(clip.layoutItem ?? DEFAULT_LAYOUT_ITEM);
  const sizing = $derived(item[axis]);
  const laidPx = $derived(Math.round(Number((laidClip(doc, clip.id) ?? clip).props[axis] ?? 0) * doc[axis]));
  const percented = $derived(sizing === Sizing.Percent);
  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);

  const limitName = (bound: Bound) => `${BOUND_LABEL[bound]} ${name.short}`;

  function type(value: number) {
    const entry = percented ? { sizing: Sizing.Percent, value } : { sizing: Sizing.Fixed, value };
    commit(setChildSize(doc, clip.id, axis, entry), `Changed the ${axis}`);
  }

  function pick(next: Sizing) {
    open = false;
    commit(setChildSize(doc, clip.id, axis, { sizing: next, value: next === Sizing.Fixed ? laidPx : undefined }), `Changed the ${axis} sizing`);
  }

  function limit(bound: Bound, input: HTMLInputElement) {
    const text = input.value.trim();
    const parsed = text === '' ? null : parseLimit(text);
    if (text !== '' && !parsed) {
      const kept = limitOf(item, axis, bound);
      input.value = kept ? formatLimit(kept) : '';
      return;
    }
    commit(setLayoutItem(doc, clip.id, limitPatch(axis, bound, parsed)), `Changed the ${BOUND_LABEL[bound].toLowerCase()} ${axis}`);
  }

  function closeOutside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) {
      open = false;
    }
  }

  const MODE = cn('flex h-full shrink-0 items-center gap-0.5 rounded-sm pr-1.5 pl-1 text-ui-label text-ui-text-2 hover:text-ui-text', FOCUS_RING);
  const LIMIT_INPUT = 'h-7 w-full min-w-0 rounded-sm bg-ui-input px-2 text-ui-label outline-none placeholder:text-ui-text-3 focus:shadow-[inset_0_0_0_1px_var(--ui-accent)]';
</script>

<svelte:window onpointerdown={closeOutside} />

{#snippet mode()}
  <button type="button" class={MODE} aria-haspopup="menu" aria-expanded={open} aria-label={`${name.label} sizing`} data-testid={`stack-unit-${axis}`} onclick={() => (open = !open)}>{SIZING_LABEL[sizing]}<ChevronDown size={12} /></button>
{/snippet}

<div class="relative min-w-0" bind:this={root} data-testid={`stack-size-${axis}`} data-sizing={sizing}>
  <NumberField label={name.short} name={name.label} value={percented ? (item[PERCENT_KEY[axis]] ?? MAX_PERCENT) : laidPx} range={percented ? PERCENT_RANGE : PX_RANGE} unit={percented ? '%' : ''} trailing={mode} onchange={type} />
  {#if open}
    <div class={cn(MENU_CONTENT, 'absolute top-full right-0 mt-1 flex flex-col gap-0.5')} role="menu" aria-label={`${name.label} sizing`} data-testid={`stack-mode-menu-${axis}`}>
      {#each sizings as option (option)}
        <button type="button" role="menuitemradio" aria-checked={option === sizing} class={MENU_ITEM} data-sizing={option} onclick={() => pick(option)}>
          <span class="grid w-3 place-items-center">{#if option === sizing}<Check size={12} />{/if}</span>{SIZING_LABEL[option]}
        </button>
      {/each}
      <div class="my-1 h-px bg-ui-divider" role="separator"></div>
      {#each BOUNDS as bound (bound)}
        {@const kept = limitOf(item, axis, bound)}
        <label class="flex items-center gap-2 px-1">
          <span class="w-12 shrink-0 text-ui-label text-ui-text-2">{limitName(bound)}</span>
          <input class={LIMIT_INPUT} aria-label={`${BOUND_LABEL[bound]} ${axis}`} placeholder="—  px or %" value={kept ? formatLimit(kept) : ''} data-testid={`stack-limit-input-${bound}-${axis}`} onchange={(e) => limit(bound, e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        </label>
      {/each}
    </div>
  {/if}
</div>
