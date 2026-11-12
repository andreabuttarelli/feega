<script lang="ts">
  import { estimatedText, type TextMeasure } from '@feega/motion-core/motion/layout/text-extent';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import WrapText from '@lucide/svelte/icons/wrap-text';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Ungroup from '@lucide/svelte/icons/ungroup';
  import Scan from '@lucide/svelte/icons/scan';
  import X from '@lucide/svelte/icons/x';
  import FoldHorizontal from '@lucide/svelte/icons/fold-horizontal';
  import FoldVertical from '@lucide/svelte/icons/fold-vertical';
  import PanelLeft from '@lucide/svelte/icons/panel-left';
  import PanelTop from '@lucide/svelte/icons/panel-top';
  import PanelRight from '@lucide/svelte/icons/panel-right';
  import PanelBottom from '@lucide/svelte/icons/panel-bottom';
  import SplitHorizontal from '@lucide/svelte/icons/square-split-horizontal';
  import SplitVertical from '@lucide/svelte/icons/square-split-vertical';
  import Columns from '@lucide/svelte/icons/columns-3';
  import type { Component } from 'svelte';
  import { FOCUS_RING, IconButton, IconSize, SegmentedControl, type SegmentOption } from '$lib/components/ui/shell';
  import { cn } from '$lib/utils.js';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { Align, Direction, Justify, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
  import { DEFAULT_LAYOUT_ITEM, MAX_GRID_COLUMNS, MAX_LAYOUT_PX, type AutoLayout, type LayoutItem, type Padding } from '@feega/motion-core/motion/layout/model';
  import { BOUNDS, LIMIT_AXES, formatLimit, limitOf, limitPatch, type Bound, type LimitAxis } from '@feega/motion-core/motion/layout/limits';
  import { layoutParent, leaveStack, removeStack, reorderChild, setAutoLayout, setLayoutItem } from '$lib/motion/layout/ops';
  import { PaddingView, SIDE_ORDER, axisPatch, paddingView, togglePadding, type PaddingAxis } from '$lib/motion/layout/padding-mode';
  import { setClipFlags } from '@feega/motion-core/motion/organize';
  import { childrenInOrder } from '@feega/motion-core/motion/layout/resolve';
  import CheckRow from './CheckRow.svelte';
  import NumberField from './NumberField.svelte';
  import { FieldKind } from '$lib/motion/number-field';
  import StackSizeChip from './StackSizeChip.svelte';

  let { doc, clip, scale = 1, measure = estimatedText, commit }: { doc: MotionDoc; clip: MotionClip; scale?: number; measure?: TextMeasure; commit: (result: OpResult, summary: string) => void } = $props();

  const GapMode = { Fixed: 'fixed', Auto: 'auto' } as const;
  type GapMode = (typeof GapMode)[keyof typeof GapMode];

  const GAP_MODES = Object.values(GapMode);
  const GAP_MODE_LABEL: Record<GapMode, string> = { [GapMode.Fixed]: 'Fixed', [GapMode.Auto]: 'Auto' };

  const Flow = { Row: 'row', Column: 'column', Wrap: 'wrap', Grid: 'grid' } as const;
  type Flow = (typeof Flow)[keyof typeof Flow];

  const FLOWS: SegmentOption[] = [
    { value: Flow.Column, label: 'Vertical', icon: ArrowDown },
    { value: Flow.Row, label: 'Horizontal', icon: ArrowRight },
    { value: Flow.Wrap, label: 'Wrap', icon: WrapText },
    { value: Flow.Grid, label: 'Grid', icon: LayoutGrid }
  ];

  const FLOW_PATCH: Record<Flow, Partial<AutoLayout>> = {
    [Flow.Row]: { direction: Direction.Horizontal, wrap: false },
    [Flow.Column]: { direction: Direction.Vertical, wrap: false },
    [Flow.Wrap]: { direction: Direction.Horizontal, wrap: true },
    [Flow.Grid]: { direction: Direction.Grid, wrap: false }
  };

  const GAP_ICON: Record<Direction, Component> = { [Direction.Horizontal]: SplitHorizontal, [Direction.Vertical]: SplitVertical, [Direction.Grid]: SplitHorizontal };
  const CROSS_GAP_ICON: Record<Direction, Component> = { [Direction.Horizontal]: SplitVertical, [Direction.Vertical]: SplitHorizontal, [Direction.Grid]: SplitVertical };
  const PADDING_AXES: { axis: PaddingAxis; label: string; icon: Component; first: keyof Padding }[] = [
    { axis: 'horizontal', label: 'Horizontal padding', icon: FoldHorizontal, first: 'left' },
    { axis: 'vertical', label: 'Vertical padding', icon: FoldVertical, first: 'top' }
  ];
  const SIDE_ICON: Record<keyof Padding, Component> = { left: PanelLeft, top: PanelTop, right: PanelRight, bottom: PanelBottom };
  const SIDE_NAME: Record<keyof Padding, string> = { left: 'Left', top: 'Top', right: 'Right', bottom: 'Bottom' };
  const LIMIT_NAME: Record<LimitAxis, Record<Bound, string>> = { width: { min: 'Min W', max: 'Max W' }, height: { min: 'Min H', max: 'Max H' } };

  const SELF_ALIGNS = ['', Align.Start, Align.Center, Align.End, Align.Stretch] as const;
  const SELF_ALIGN_LABEL: Record<(typeof SELF_ALIGNS)[number], string> = { '': 'Auto', [Align.Start]: 'Start', [Align.Center]: 'Center', [Align.End]: 'End', [Align.Stretch]: 'Stretch' };
  const SPOTS = [Align.Start, Align.Center, Align.End] as const;
  const CELL_ALIGNS = ['', Align.Start, Align.Center, Align.End] as const;
  const CELL_ALIGN_LABEL: Record<(typeof CELL_ALIGNS)[number], string> = { '': 'Auto', [Align.Start]: 'Start', [Align.Center]: 'Center', [Align.End]: 'End' };
  const AS_JUSTIFY: Record<Align, Justify> = { [Align.Start]: Justify.Start, [Align.Center]: Justify.Center, [Align.End]: Justify.End, [Align.Baseline]: Justify.Start, [Align.Stretch]: Justify.Start };
  const FLOW_OF: Record<Direction, Flow> = { [Direction.Horizontal]: Flow.Row, [Direction.Vertical]: Flow.Column, [Direction.Grid]: Flow.Grid };
  const PX_RANGE = { min: 0, max: MAX_LAYOUT_PX, step: 1 };
  const GAP_RANGE = { min: -MAX_LAYOUT_PX, max: MAX_LAYOUT_PX, step: 1 };
  const COLUMN_RANGE = { min: 1, max: MAX_GRID_COLUMNS, step: 1 };

  const layout = $derived(clip.autoLayout ?? null);
  let split = $state(false);
  const padView = $derived(layout ? paddingView(layout.padding, split) : PaddingView.Axes);
  const gapMode = $derived(layout?.justify === Justify.SpaceBetween ? GapMode.Auto : GapMode.Fixed);
  const parent = $derived(layoutParent(doc, clip));
  const inGrid = $derived(parent?.autoLayout?.direction === Direction.Grid);
  const item = $derived(clip.layoutItem ?? DEFAULT_LAYOUT_ITEM);
  const flow = $derived(layout?.wrap ? Flow.Wrap : FLOW_OF[layout?.direction ?? Direction.Horizontal]);
  const lined = $derived(!!layout && (layout.wrap || layout.direction === Direction.Grid));
  const siblings = $derived(parent ? childrenInOrder(doc.tracks.flatMap((t) => t.clips as MotionClip[]), parent).map((c) => c.id) : []);
  const place = $derived(siblings.indexOf(clip.id));
  const sizings = $derived(parent ? [Sizing.Fixed, Sizing.Hug, Sizing.Fill, Sizing.Percent] : [Sizing.Fixed, Sizing.Hug]);
  const limits = $derived(LIMIT_AXES.flatMap((axis) => BOUNDS.flatMap((bound) => { const limit = limitOf(item, axis, bound); return limit ? [{ axis, bound, limit }] : []; })));

  const set = (patch: Partial<AutoLayout>, summary: string) => commit(setAutoLayout(doc, clip.id, patch), summary);
  const size = (patch: Partial<LayoutItem>, summary: string) => commit(setLayoutItem(doc, clip.id, patch), summary);
  const whole = (value: number) => Math.max(0, Math.round(value));
  const shown = (px: number) => Math.round(px * scale * 100) / 100;
  const kept = (value: number) => value / scale;
  const span = (value: string) => Math.max(1, Math.round(Number(value) || 1));
  const cellAlign = (value: string) => (value === '' ? undefined : (value as Align));
  const typeGap = (value: number) => set({ gap: Math.round(kept(value)), ...(gapMode === GapMode.Auto ? { justify: Justify.Start } : {}) }, 'Changed the gap');
  const pickGapMode = (mode: GapMode) => set({ justify: mode === GapMode.Auto ? Justify.SpaceBetween : Justify.Start }, 'Changed the gap');

  function toggleSides(padding: Padding, view: PaddingView) {
    const next = togglePadding(padding, view);
    split = next.split;
    if (next.padding) {
      set({ padding: next.padding }, 'Changed the padding');
    }
  }

  function spotPressed(layout: AutoLayout, column: Align, row: Align): boolean {
    const [main, cross] = layout.direction === Direction.Horizontal ? [column, row] : [row, column];
    return (layout.justify === AS_JUSTIFY[main] || layout.justify === Justify.SpaceBetween) && layout.align === cross;
  }

  function pickSpot(layout: AutoLayout, column: Align, row: Align) {
    const [main, cross] = layout.direction === Direction.Horizontal ? [column, row] : [row, column];
    set({ justify: layout.justify === Justify.SpaceBetween ? Justify.SpaceBetween : AS_JUSTIFY[main], align: cross }, 'Aligned the stack');
  }

  const SPOT = cn('hit rounded-full [--glyph-fill:var(--ui-input)] [--glyph-radius:9999px] [--glyph:16px] hover:[--glyph-fill:var(--ui-input-hover)] aria-pressed:[--glyph-fill:var(--ui-accent-solid)]', FOCUS_RING);
  const TRAIL = cn('h-full max-w-16 shrink-0 cursor-pointer appearance-none rounded-sm bg-transparent pr-2 pl-1 text-right text-ui-label text-ui-text-2 outline-none hover:text-ui-text', FOCUS_RING);
  const SELECT_CHIP = 'flex h-7 min-w-0 items-center gap-1 rounded-md bg-ui-input pl-2 text-ui-label';
  const CHIP_SELECT = cn('h-full min-w-0 flex-1 cursor-pointer appearance-none rounded-sm bg-transparent pr-2 text-right text-ui-label outline-none', FOCUS_RING);
  const SPAN_RANGE = { min: 1, max: MAX_GRID_COLUMNS, step: 1 };
  const LIMIT_CHIP = 'flex h-7 items-center gap-1 rounded-md bg-ui-input pl-2 text-ui-label';
</script>

{#snippet gapTrail()}
  <select aria-label="Gap mode" class={TRAIL} value={gapMode} data-testid="auto-layout-gap-mode" onchange={(e) => pickGapMode(e.currentTarget.value as GapMode)}>
    {#each GAP_MODES as mode (mode)}<option value={mode} selected={mode === gapMode}>{GAP_MODE_LABEL[mode]}</option>{/each}
  </select>
{/snippet}

<div class="flex flex-col gap-1.5" data-testid="stack-section">
  {#if layout}
    <div class="flex items-center gap-1.5">
      <div class="flex min-w-0 flex-1" data-testid="auto-layout-direction"><SegmentedControl label="Direction" options={FLOWS} value={flow} onchange={(v) => set(FLOW_PATCH[v as Flow], 'Changed the direction')} /></div>
      <IconButton label="Remove stack" size={IconSize.Sm} data-testid="auto-layout-remove" onclick={() => commit(removeStack(doc, clip.id), 'Removed the stack')}><Ungroup /></IconButton>
    </div>
  {/if}

  {#if layout || parent}
    <div class="grid grid-cols-2 gap-1.5">
      {#each LIMIT_AXES as axis (axis)}<StackSizeChip {doc} {clip} {axis} {measure} {sizings} {commit} />{/each}
    </div>
    {#if limits.length}
      <div class="flex flex-wrap gap-1.5" data-testid="stack-limits">
        {#each limits as { axis, bound, limit } (`${bound}-${axis}`)}
          <span class={LIMIT_CHIP} data-testid={`stack-limit-${bound}-${axis}`}>
            <span class="text-ui-text-2">{LIMIT_NAME[axis][bound]}</span>{formatLimit(limit)}
            <IconButton label={`Clear ${LIMIT_NAME[axis][bound]}`} size={IconSize.Sm} data-testid={`stack-limit-clear-${bound}-${axis}`} onclick={() => size(limitPatch(axis, bound, null), `Cleared the ${bound} ${axis}`)}><X /></IconButton>
          </span>
        {/each}
      </div>
    {/if}
  {/if}

  {#if layout}
    {#if layout.direction === Direction.Grid}
      <div class="grid grid-cols-2 gap-1.5" data-testid="auto-layout-columns">
        <NumberField label="Columns" name="Columns" icon={Columns} value={layout.columns} range={COLUMN_RANGE} onchange={(v) => set({ columns: Math.round(v) }, 'Changed the columns')} />
      </div>
    {/if}

    <div class="flex items-start gap-1.5">
      <div class="grid shrink-0 grid-cols-3 rounded-md bg-ui-input" role="group" aria-label="Alignment" data-testid="auto-layout-align">
        {#each SPOTS as row (row)}
          {#each SPOTS as column (column)}
            <button type="button" class={SPOT} aria-label={`Align ${row} ${column}`} aria-pressed={spotPressed(layout, column, row)} onclick={() => pickSpot(layout, column, row)}></button>
          {/each}
        {/each}
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <div data-testid="auto-layout-gap" data-mode={gapMode}>
          <NumberField label="Gap" name="Gap" icon={GAP_ICON[layout.direction]} value={shown(layout.gap)} blank={gapMode === GapMode.Auto ? GAP_MODE_LABEL[GapMode.Auto] : null} range={GAP_RANGE} trailing={gapTrail} onchange={typeGap} />
        </div>
        {#if lined}
          <div data-testid="auto-layout-cross-gap">
            <NumberField label="Line gap" name="Gap between lines" icon={CROSS_GAP_ICON[layout.direction]} value={shown(layout.crossGap)} range={GAP_RANGE} onchange={(v) => set({ crossGap: Math.round(kept(v)) }, 'Changed the gap between lines')} />
          </div>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-1.5" data-testid="auto-layout-padding" data-view={padView}>
      {#if padView === PaddingView.Sides}
        <div class="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
          {#each SIDE_ORDER as side (side)}
            <div data-testid={`auto-layout-padding-${side}`}>
              <NumberField label={SIDE_NAME[side]} name={`${SIDE_NAME[side]} padding`} icon={SIDE_ICON[side]} value={shown(layout.padding[side])} range={PX_RANGE} onchange={(v) => set({ padding: { ...layout.padding, [side]: whole(kept(v)) } }, 'Changed the padding')} />
            </div>
          {/each}
        </div>
      {:else}
        <div class="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
          {#each PADDING_AXES as pad (pad.axis)}
            <div data-testid={`auto-layout-padding-${pad.axis === 'horizontal' ? 'x' : 'y'}`}>
              <NumberField label={pad.label} name={pad.label} icon={pad.icon} value={shown(layout.padding[pad.first])} range={PX_RANGE} onchange={(v) => set({ padding: axisPatch(layout.padding, pad.axis, whole(kept(v))) }, 'Changed the padding')} />
            </div>
          {/each}
        </div>
      {/if}
      <IconButton label={padView === PaddingView.Sides ? 'Padding as horizontal and vertical' : 'Padding per side'} size={IconSize.Sm} pressed={padView === PaddingView.Sides} data-testid="auto-layout-padding-sides" onclick={() => toggleSides(layout.padding, padView)}><Scan /></IconButton>
    </div>

    <CheckRow label="Clip content" checked={!!clip.clipContent} testid="stack-clip-content" onchange={(on) => commit(setClipFlags(doc, clip.id, { clipContent: on }), 'Changed clip content')} />
  {/if}

  {#if inGrid}
    <div class="grid grid-cols-2 gap-1.5" data-testid="auto-layout-span">
      <div data-testid="auto-layout-column-span"><NumberField label="Cols" kind={FieldKind.Named} name="Column span" value={item.columnSpan} range={SPAN_RANGE} onchange={(v) => size({ columnSpan: span(String(v)) }, 'Changed the column span')} /></div>
      <div data-testid="auto-layout-row-span"><NumberField label="Rows" kind={FieldKind.Named} name="Row span" value={item.rowSpan} range={SPAN_RANGE} onchange={(v) => size({ rowSpan: span(String(v)) }, 'Changed the row span')} /></div>
    </div>
    <div class="grid grid-cols-2 gap-1.5">
      <label class={SELECT_CHIP}>
        <span class="text-ui-text-2">X</span>
        <select aria-label="Horizontal in cell" class={CHIP_SELECT} value={item.cellX ?? ''} data-testid="auto-layout-cell-x" onchange={(e) => size({ cellX: cellAlign(e.currentTarget.value) }, 'Aligned in the cell')}>
          {#each CELL_ALIGNS as value (value)}<option {value}>{CELL_ALIGN_LABEL[value]}</option>{/each}
        </select>
      </label>
      <label class={SELECT_CHIP}>
        <span class="text-ui-text-2">Y</span>
        <select aria-label="Vertical in cell" class={CHIP_SELECT} value={item.cellY ?? ''} data-testid="auto-layout-cell-y" onchange={(e) => size({ cellY: cellAlign(e.currentTarget.value) }, 'Aligned in the cell')}>
          {#each CELL_ALIGNS as value (value)}<option {value}>{CELL_ALIGN_LABEL[value]}</option>{/each}
        </select>
      </label>
    </div>
  {/if}

  {#if parent && !inGrid && !item.absolute}
    <label class={SELECT_CHIP}>
      <span class="text-ui-text-2">Align</span>
      <select aria-label="Align self" class={CHIP_SELECT} value={item.alignSelf ?? ''} data-testid="stack-align-self" onchange={(e) => size({ alignSelf: cellAlign(e.currentTarget.value) }, 'Aligned in the stack')}>
        {#each SELF_ALIGNS as value (value)}<option {value}>{SELF_ALIGN_LABEL[value]}</option>{/each}
      </select>
    </label>
  {/if}

  {#if parent}
    <div class="flex items-center gap-1.5">
      <div class="flex min-w-0 flex-1"><CheckRow label="Ignore auto layout" checked={!!item.absolute} testid="auto-layout-absolute" onchange={(on) => size({ absolute: on }, 'Changed absolute position')} /></div>
      {#if siblings.length > 1}
        <IconButton label="Move earlier" size={IconSize.Sm} disabled={place <= 0} onclick={() => commit(reorderChild(doc, parent.id, clip.id, place - 1), 'Reordered in the stack')}><ChevronUp /></IconButton>
        <IconButton label="Move later" size={IconSize.Sm} disabled={place < 0 || place >= siblings.length - 1} onclick={() => commit(reorderChild(doc, parent.id, clip.id, place + 1), 'Reordered in the stack')}><ChevronDown /></IconButton>
      {/if}
      <IconButton label="Take out of the stack" size={IconSize.Sm} data-testid="auto-layout-leave" onclick={() => commit(leaveStack(doc, clip.id), 'Took the clip out of the stack')}><LogOut /></IconButton>
    </div>
  {/if}
</div>
