<script lang="ts">
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import WrapText from '@lucide/svelte/icons/wrap-text';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import Plus from '@lucide/svelte/icons/plus';
  import Minus from '@lucide/svelte/icons/minus';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import LogOut from '@lucide/svelte/icons/log-out';
  import SpaceBetween from '@lucide/svelte/icons/align-horizontal-space-between';
  import SpaceAround from '@lucide/svelte/icons/align-horizontal-space-around';
  import SpaceEvenly from '@lucide/svelte/icons/align-horizontal-distribute-center';
  import { FIELD_INPUT, FOCUS_RING, Field, IconButton, IconSize, Section, SegmentedControl, type SegmentOption } from '$lib/components/ui/shell';
  import { cn } from '$lib/utils.js';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { Align, Direction, Justify, Sizing } from '$lib/motion/layout/auto-layout';
  import { DEFAULT_LAYOUT_ITEM, MAX_GRID_COLUMNS, type AutoLayout, type LayoutItem, type Padding } from '$lib/motion/layout/model';
  import { hasBox, layoutParent, leaveAutoLayout, reorderChild, setAutoLayout, setLayoutItem } from '$lib/motion/layout/ops';
  import { childrenInOrder } from '$lib/motion/layout/resolve';
  import { Answer, YES_NO, answerOf } from '$lib/motion/segments';
  import SegmentedField from './SegmentedField.svelte';

  let { doc, clip, commit }: { doc: MotionDoc; clip: MotionClip; commit: (result: OpResult, summary: string) => void } = $props();

  const Flow = { Row: 'row', Column: 'column', Wrap: 'wrap', Grid: 'grid' } as const;
  type Flow = (typeof Flow)[keyof typeof Flow];

  const FLOWS: SegmentOption[] = [
    { value: Flow.Row, label: 'Horizontal', icon: ArrowRight },
    { value: Flow.Column, label: 'Vertical', icon: ArrowDown },
    { value: Flow.Wrap, label: 'Wrap', icon: WrapText },
    { value: Flow.Grid, label: 'Grid', icon: LayoutGrid }
  ];

  const FLOW_PATCH: Record<Flow, Partial<AutoLayout>> = {
    [Flow.Row]: { direction: Direction.Horizontal, wrap: false },
    [Flow.Column]: { direction: Direction.Vertical, wrap: false },
    [Flow.Wrap]: { direction: Direction.Horizontal, wrap: true },
    [Flow.Grid]: { direction: Direction.Grid, wrap: false }
  };

  const SIZING_LABEL: Record<Sizing, string> = { [Sizing.Fixed]: 'Fixed', [Sizing.Hug]: 'Fit', [Sizing.Fill]: 'Fill' };
  const SIDES: (keyof Padding)[] = ['top', 'right', 'bottom', 'left'];
  const SIDE_LABEL: Record<keyof Padding, string> = { top: 'T', right: 'R', bottom: 'B', left: 'L' };
  const SPOTS = [Align.Start, Align.Center, Align.End] as const;
  const SPREADS = [
    { justify: Justify.SpaceBetween, label: 'Space between', testid: 'auto-layout-space-between', icon: SpaceBetween },
    { justify: Justify.SpaceAround, label: 'Space around', testid: 'auto-layout-space-around', icon: SpaceAround },
    { justify: Justify.SpaceEvenly, label: 'Space evenly', testid: 'auto-layout-space-evenly', icon: SpaceEvenly }
  ];
  const AS_JUSTIFY: Record<Align, Justify> = { [Align.Start]: Justify.Start, [Align.Center]: Justify.Center, [Align.End]: Justify.End };

  const layout = $derived(clip.autoLayout ?? null);
  let splitPadding = $state(false);
  const evenPadding = $derived(!!layout && SIDES.every((side) => layout.padding[side] === layout.padding.top));
  const perSide = $derived(splitPadding || !evenPadding);
  const parent = $derived(layoutParent(doc, clip));
  const item = $derived(clip.layoutItem ?? DEFAULT_LAYOUT_ITEM);
  const FLOW_OF: Record<Direction, Flow> = { [Direction.Horizontal]: Flow.Row, [Direction.Vertical]: Flow.Column, [Direction.Grid]: Flow.Grid };
  const flow = $derived(layout?.wrap ? Flow.Wrap : FLOW_OF[layout?.direction ?? Direction.Horizontal]);
  const lined = $derived(!!layout && (layout.wrap || layout.direction === Direction.Grid));
  const siblings = $derived(parent ? childrenInOrder(doc.tracks.flatMap((t) => t.clips as MotionClip[]), parent).map((c) => c.id) : []);
  const place = $derived(siblings.indexOf(clip.id));
  const sizings = $derived((parent ? [Sizing.Fixed, Sizing.Hug, Sizing.Fill] : [Sizing.Fixed, Sizing.Hug]).map((value) => ({ value, label: SIZING_LABEL[value] })));

  const set = (patch: Partial<AutoLayout>, summary: string) => commit(setAutoLayout(doc, clip.id, patch), summary);
  const size = (patch: Partial<LayoutItem>, summary: string) => commit(setLayoutItem(doc, clip.id, patch), summary);
  const px = (value: string) => Math.max(0, Math.round(Number(value) || 0));
  const signedPx = (value: string) => Math.round(Number(value) || 0);
  const optionalPx = (value: string) => (value.trim() === '' ? undefined : px(value));

  function spotPressed(layout: AutoLayout, column: Align, row: Align): boolean {
    const [main, cross] = layout.direction === Direction.Horizontal ? [column, row] : [row, column];
    return layout.justify === AS_JUSTIFY[main] && layout.align === cross;
  }

  function pickSpot(layout: AutoLayout, column: Align, row: Align) {
    const [main, cross] = layout.direction === Direction.Horizontal ? [column, row] : [row, column];
    set({ justify: AS_JUSTIFY[main], align: cross }, 'Aligned the auto layout');
  }

  const SPOT = cn('size-4 rounded-full bg-ui-input transition-colors duration-(--ui-dur-fast) hover:bg-ui-input-hover aria-pressed:bg-ui-accent-solid', FOCUS_RING);
</script>

<div data-testid="auto-layout-section">
  <Section title="Auto layout">
    {#snippet actions()}
      {#if layout}
        <IconButton label="Remove auto layout" size={IconSize.Sm} data-testid="auto-layout-remove" onclick={() => commit(setAutoLayout(doc, clip.id, null), 'Removed auto layout')}><Minus /></IconButton>
      {:else if hasBox(clip)}
        <IconButton label="Add auto layout" shortcut="⇧A" size={IconSize.Sm} data-testid="auto-layout-add" onclick={() => set({}, 'Added auto layout')}><Plus /></IconButton>
      {/if}
    {/snippet}

    {#if layout}
      <Field label="Direction">
        <SegmentedControl label="Direction" options={FLOWS} value={flow} onchange={(v) => set(FLOW_PATCH[v as Flow], 'Changed the direction')} />
      </Field>
      {#if layout.direction === Direction.Grid}
        <Field label="Columns" id="auto-layout-columns">
          <input id="auto-layout-columns" class={cn(FIELD_INPUT, 'w-full')} type="number" min="1" max={MAX_GRID_COLUMNS} value={layout.columns} data-testid="auto-layout-columns" onchange={(e) => set({ columns: Math.min(MAX_GRID_COLUMNS, Math.max(1, px(e.currentTarget.value))) }, 'Changed the columns')} />
        </Field>
      {/if}
      <Field label="Align">
        <div class="grid grid-cols-3 gap-1 rounded-sm bg-ui-sunken p-1.5" role="group" aria-label="Alignment" data-testid="auto-layout-align">
          {#each SPOTS as row (row)}
            {#each SPOTS as column (column)}
              <button type="button" class={SPOT} aria-label={`Align ${row} ${column}`} aria-pressed={spotPressed(layout, column, row)} onclick={() => pickSpot(layout, column, row)}></button>
            {/each}
          {/each}
        </div>
        {#each SPREADS as spread (spread.justify)}
          <IconButton label={spread.label} size={IconSize.Sm} pressed={layout.justify === spread.justify} data-testid={spread.testid} onclick={() => set({ justify: layout.justify === spread.justify ? Justify.Start : spread.justify }, 'Changed the spacing')}><spread.icon /></IconButton>
        {/each}
      </Field>
      <Field label="Gap" id="auto-layout-gap">
        <input id="auto-layout-gap" class={cn(FIELD_INPUT, 'w-full')} type="number" value={layout.gap} data-testid="auto-layout-gap" onchange={(e) => set({ gap: signedPx(e.currentTarget.value) }, 'Changed the gap')} />
        {#if lined}
          <input aria-label="Gap between lines" class={cn(FIELD_INPUT, 'w-full')} type="number" value={layout.crossGap} onchange={(e) => set({ crossGap: signedPx(e.currentTarget.value) }, 'Changed the gap between lines')} />
        {/if}
      </Field>
      <Field label="Padding">
        {#if perSide}
          {#each SIDES as side (side)}
            <input aria-label={`Padding ${side}`} title={SIDE_LABEL[side]} class={cn(FIELD_INPUT, 'w-full px-1')} type="number" min="0" value={layout.padding[side]} data-testid={`auto-layout-padding-${side}`} onchange={(e) => set({ padding: { ...layout.padding, [side]: px(e.currentTarget.value) } }, 'Changed the padding')} />
          {/each}
        {:else}
          <input aria-label="Padding" class={cn(FIELD_INPUT, 'w-full')} type="number" min="0" value={layout.padding.top} data-testid="auto-layout-padding" onchange={(e) => set({ padding: { top: px(e.currentTarget.value), right: px(e.currentTarget.value), bottom: px(e.currentTarget.value), left: px(e.currentTarget.value) } }, 'Changed the padding')} />
          <button type="button" class={cn('shrink-0 rounded-sm px-1.5 text-ui-label text-ui-text-2 hover:bg-ui-wash', FOCUS_RING)} data-testid="auto-layout-padding-sides" onclick={() => (splitPadding = true)}>Per side</button>
        {/if}
      </Field>
    {/if}

    {#if layout || parent}
      <Field label="Width">
        <SegmentedControl label="Width sizing" options={sizings} value={item.width} onchange={(v) => size({ width: v as Sizing }, 'Changed the width sizing')} />
      </Field>
      <Field label="Height">
        <SegmentedControl label="Height sizing" options={sizings} value={item.height} onchange={(v) => size({ height: v as Sizing }, 'Changed the height sizing')} />
      </Field>
      <Field label="Min / max W">
        <input aria-label="Min width" placeholder="min" class={cn(FIELD_INPUT, 'w-full')} type="number" min="0" value={item.minWidth ?? ''} onchange={(e) => size({ minWidth: optionalPx(e.currentTarget.value) }, 'Changed the min width')} />
        <input aria-label="Max width" placeholder="max" class={cn(FIELD_INPUT, 'w-full')} type="number" min="0" value={item.maxWidth ?? ''} onchange={(e) => size({ maxWidth: optionalPx(e.currentTarget.value) }, 'Changed the max width')} />
      </Field>
      <Field label="Min / max H">
        <input aria-label="Min height" placeholder="min" class={cn(FIELD_INPUT, 'w-full')} type="number" min="0" value={item.minHeight ?? ''} onchange={(e) => size({ minHeight: optionalPx(e.currentTarget.value) }, 'Changed the min height')} />
        <input aria-label="Max height" placeholder="max" class={cn(FIELD_INPUT, 'w-full')} type="number" min="0" value={item.maxHeight ?? ''} onchange={(e) => size({ maxHeight: optionalPx(e.currentTarget.value) }, 'Changed the max height')} />
      </Field>
    {/if}

    {#if parent}
      <Field label="In layout">
        <div class="flex min-w-0 flex-1" data-testid="auto-layout-absolute"><SegmentedField name="Absolute" options={YES_NO} value={answerOf(item.absolute)} onchange={(v) => size({ absolute: v === Answer.Yes }, 'Changed absolute position')} /></div>
        <IconButton label="Move earlier" size={IconSize.Sm} disabled={place <= 0} onclick={() => commit(reorderChild(doc, parent.id, clip.id, place - 1), 'Reordered in the auto layout')}><ChevronUp /></IconButton>
        <IconButton label="Move later" size={IconSize.Sm} disabled={place < 0 || place >= siblings.length - 1} onclick={() => commit(reorderChild(doc, parent.id, clip.id, place + 1), 'Reordered in the auto layout')}><ChevronDown /></IconButton>
        <IconButton label="Take out of the auto layout" size={IconSize.Sm} data-testid="auto-layout-leave" onclick={() => commit(leaveAutoLayout(doc, clip.id), 'Took the clip out of the auto layout')}><LogOut /></IconButton>
      </Field>
    {/if}
  </Section>
</div>
