<script lang="ts">
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import WrapText from '@lucide/svelte/icons/wrap-text';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import StretchVertical from '@lucide/svelte/icons/stretch-vertical';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Baseline from '@lucide/svelte/icons/baseline';
  import SpaceAround from '@lucide/svelte/icons/align-horizontal-space-around';
  import SpaceEvenly from '@lucide/svelte/icons/align-horizontal-distribute-center';
  import Ungroup from '@lucide/svelte/icons/ungroup';
  import Settings2 from '@lucide/svelte/icons/settings-2';
  import Scan from '@lucide/svelte/icons/scan';
  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
  import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
  import { FIELD_INPUT, FOCUS_RING, Field, IconButton, IconSize, SegmentedControl, type SegmentOption } from '$lib/components/ui/shell';
  import { untrack } from 'svelte';
  import { cn } from '$lib/utils.js';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { Align, AlignContent, AutoFlow, Direction, Justify, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
  import { formatTracks, parseTracks } from '$lib/motion/layout/tracks-text';
  import { DEFAULT_LAYOUT_ITEM, MAX_GRID_COLUMNS, type AutoLayout, type LayoutItem, type Padding } from '@feega/motion-core/motion/layout/model';
  import { laidClip, layoutParent, leaveStack, removeStack, reorderChild, setAutoLayout, setChildSize, setLayoutItem } from '$lib/motion/layout/ops';
  import { setClipFlags } from '@feega/motion-core/motion/organize';
  import { MAX_PERCENT, formatSize, parseSize, type SizeEntry } from '@feega/motion-core/motion/layout/size-entry';
  import { childrenInOrder } from '@feega/motion-core/motion/layout/resolve';
  import { Answer, YES_NO, answerOf } from '$lib/motion/segments';
  import SegmentedField from './SegmentedField.svelte';

  let { doc, clip, commit, advanced = false }: { doc: MotionDoc; clip: MotionClip; commit: (result: OpResult, summary: string) => void; advanced?: boolean } = $props();

  const GapMode = { Fixed: 'fixed', Auto: 'auto' } as const;
  type GapMode = (typeof GapMode)[keyof typeof GapMode];

  const GAP_MODES = Object.values(GapMode);
  const GAP_MODE_LABEL: Record<GapMode, string> = { [GapMode.Fixed]: 'px', [GapMode.Auto]: 'Auto' };
  const GAP_MODE_JUSTIFY: Record<GapMode, Justify> = { [GapMode.Fixed]: Justify.Start, [GapMode.Auto]: Justify.SpaceBetween };

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

  const SIZING_LABEL: Record<Sizing, string> = { [Sizing.Fixed]: 'Fixed', [Sizing.Hug]: 'Hug', [Sizing.Fill]: 'Fill', [Sizing.Percent]: '%' };
  const AXES = [
    { axis: 'width', label: 'Width', short: 'W', grow: 'widthGrow', percent: 'widthPercent' },
    { axis: 'height', label: 'Height', short: 'H', grow: 'heightGrow', percent: 'heightPercent' }
  ] as const;
  type AxisRow = (typeof AXES)[number];
  const SELF_ALIGNS = ['', Align.Start, Align.Center, Align.End, Align.Stretch] as const;
  const SELF_ALIGN_LABEL: Record<(typeof SELF_ALIGNS)[number], string> = { '': 'Auto', [Align.Start]: 'Start', [Align.Center]: 'Center', [Align.End]: 'End', [Align.Stretch]: 'Stretch' };
  const SIDES: (keyof Padding)[] = ['top', 'right', 'bottom', 'left'];
  const SIDE_LABEL: Record<keyof Padding, string> = { top: 'T', right: 'R', bottom: 'B', left: 'L' };
  const HORIZONTAL_SIDES: readonly (keyof Padding)[] = ['left', 'right'];
  const VERTICAL_SIDES: readonly (keyof Padding)[] = ['top', 'bottom'];
  const SPOTS = [Align.Start, Align.Center, Align.End] as const;
  const SPREADS = [
    { justify: Justify.SpaceAround, label: 'Space around', testid: 'auto-layout-space-around', icon: SpaceAround },
    { justify: Justify.SpaceEvenly, label: 'Space evenly', testid: 'auto-layout-space-evenly', icon: SpaceEvenly }
  ];
  const AUTO_FLOWS: SegmentOption[] = [
    { value: AutoFlow.Row, label: 'Rows first' },
    { value: AutoFlow.Column, label: 'Columns first' }
  ];
  const LINE_SPREADS: SegmentOption[] = [
    { value: AlignContent.Auto, label: 'Packed' },
    { value: AlignContent.SpaceBetween, label: 'Space between' }
  ];
  const CELL_ALIGNS = ['', Align.Start, Align.Center, Align.End] as const;
  const CELL_ALIGN_LABEL: Record<(typeof CELL_ALIGNS)[number], string> = { '': 'Auto', [Align.Start]: 'Start', [Align.Center]: 'Center', [Align.End]: 'End' };
  const AS_JUSTIFY: Record<Align, Justify> = { [Align.Start]: Justify.Start, [Align.Center]: Justify.Center, [Align.End]: Justify.End, [Align.Baseline]: Justify.Start, [Align.Stretch]: Justify.Start };

  const layout = $derived(clip.autoLayout ?? null);
  let splitPadding = $state(false);
  let advancedOpen = $state(untrack(() => advanced));
  const symmetricPadding = $derived(!!layout && layout.padding.left === layout.padding.right && layout.padding.top === layout.padding.bottom);
  const perSide = $derived(splitPadding || !symmetricPadding);
  const gapMode = $derived(layout?.justify === Justify.SpaceBetween ? GapMode.Auto : GapMode.Fixed);
  const sizeShown = $derived(advancedOpen || !layout);
  const parent = $derived(layoutParent(doc, clip));
  const inGrid = $derived(parent?.autoLayout?.direction === Direction.Grid);
  const item = $derived(clip.layoutItem ?? DEFAULT_LAYOUT_ITEM);
  const FLOW_OF: Record<Direction, Flow> = { [Direction.Horizontal]: Flow.Row, [Direction.Vertical]: Flow.Column, [Direction.Grid]: Flow.Grid };
  const flow = $derived(layout?.wrap ? Flow.Wrap : FLOW_OF[layout?.direction ?? Direction.Horizontal]);
  const lined = $derived(!!layout && (layout.wrap || layout.direction === Direction.Grid));
  const siblings = $derived(parent ? childrenInOrder(doc.tracks.flatMap((t) => t.clips as MotionClip[]), parent).map((c) => c.id) : []);
  const place = $derived(siblings.indexOf(clip.id));
  const sizings = $derived(parent ? [Sizing.Fixed, Sizing.Percent, Sizing.Fill, Sizing.Hug] : [Sizing.Fixed, Sizing.Hug]);
  const pixels = (row: AxisRow) => Number(clip.props[row.axis] ?? 0) * doc[row.axis];
  const VALUE_OF: Record<Sizing, (row: AxisRow) => number | undefined> = {
    [Sizing.Fixed]: (row) => pixels(row),
    [Sizing.Hug]: () => undefined,
    [Sizing.Fill]: (row) => item[row.grow] ?? 1,
    [Sizing.Percent]: (row) => item[row.percent] ?? MAX_PERCENT
  };
  const entryOf = (row: AxisRow): SizeEntry => ({ sizing: item[row.axis], value: VALUE_OF[item[row.axis]](row) });
  const laid = $derived(laidClip(doc, clip.id) ?? clip);
  const laidPixels = (row: AxisRow) => String(Math.round(Number(laid.props[row.axis] ?? 0) * doc[row.axis]));
  const SHOWN_AS: Record<Sizing, (row: AxisRow) => string> = {
    [Sizing.Fixed]: (row) => formatSize(entryOf(row)),
    [Sizing.Hug]: laidPixels,
    [Sizing.Fill]: laidPixels,
    [Sizing.Percent]: (row) => formatSize(entryOf(row))
  };

  function typeSize(row: AxisRow, text: string) {
    const entry = parseSize(text);
    if (entry && sizings.includes(entry.sizing)) {
      commit(setChildSize(doc, clip.id, row.axis, entry), `Changed the ${row.axis}`);
    }
  }

  const pickUnit = (row: AxisRow, sizing: Sizing) => commit(setChildSize(doc, clip.id, row.axis, { sizing, value: sizing === Sizing.Fixed ? pixels(row) : undefined }), `Changed the ${row.axis} sizing`);

  const set = (patch: Partial<AutoLayout>, summary: string) => commit(setAutoLayout(doc, clip.id, patch), summary);
  const size = (patch: Partial<LayoutItem>, summary: string) => commit(setLayoutItem(doc, clip.id, patch), summary);
  const px = (value: string) => Math.max(0, Math.round(Number(value) || 0));
  const signedPx = (value: string) => Math.round(Number(value) || 0);
  const span = (value: string) => Math.max(1, Math.round(Number(value) || 1));
  const cellAlign = (value: string) => (value === '' ? undefined : (value as Align));

  const padAxis = (padding: Padding, sides: readonly (keyof Padding)[], value: string): Padding => ({ ...padding, ...Object.fromEntries(sides.map((side) => [side, px(value)])) });

  function toggleSides(padding: Padding) {
    if (!perSide) {
      splitPadding = true;
      return;
    }
    splitPadding = false;
    set({ padding: { top: padding.top, bottom: padding.top, left: padding.left, right: padding.left } }, 'Changed the padding');
  }

  function setTracks(key: 'columnTracks' | 'rowTracks', text: string, summary: string) {
    const tracks = parseTracks(text);
    if (tracks) {
      set({ [key]: tracks }, summary);
    }
  }

  const optionalPx = (value: string) => (value.trim() === '' ? undefined : px(value));

  function spotPressed(layout: AutoLayout, column: Align, row: Align): boolean {
    const [main, cross] = layout.direction === Direction.Horizontal ? [column, row] : [row, column];
    return layout.justify === AS_JUSTIFY[main] && layout.align === cross;
  }

  function pickSpot(layout: AutoLayout, column: Align, row: Align) {
    const [main, cross] = layout.direction === Direction.Horizontal ? [column, row] : [row, column];
    set({ justify: AS_JUSTIFY[main], align: cross }, 'Aligned the stack');
  }

  const PREFIX = 'grid w-3 shrink-0 place-items-center text-ui-label text-ui-text-2';
  const SPOT = cn('size-4 rounded-full bg-ui-input transition-colors duration-(--ui-dur-fast) hover:bg-ui-input-hover aria-pressed:bg-ui-accent-solid', FOCUS_RING);
</script>

<div data-testid="stack-section">
    {#if layout}
      <div class="flex items-center gap-1.5">
        <div class="flex min-w-0 flex-1" data-testid="auto-layout-direction"><SegmentedControl label="Direction" options={FLOWS} value={flow} onchange={(v) => set(FLOW_PATCH[v as Flow], 'Changed the direction')} /></div>
        <IconButton label="Remove stack" size={IconSize.Sm} data-testid="auto-layout-remove" onclick={() => commit(removeStack(doc, clip.id), 'Removed the stack')}><Ungroup /></IconButton>
      </div>
    {/if}

    {#if layout || parent}
      <div class="mt-1.5 grid grid-cols-2 gap-1.5">
        {#each AXES as row (row.axis)}
          <div class="flex min-w-0 items-center gap-1">
            <span class={PREFIX} aria-hidden="true">{row.short}</span>
            <input aria-label={row.label} title={row.label} class={cn(FIELD_INPUT, 'w-full min-w-0')} placeholder={row.short} value={SHOWN_AS[item[row.axis]](row)} data-testid={`stack-size-${row.axis}`} onchange={(e) => typeSize(row, e.currentTarget.value)} />
            <select aria-label={`${row.label} sizing`} class={cn(FIELD_INPUT, 'w-14 shrink-0')} value={item[row.axis]} data-testid={`stack-unit-${row.axis}`} onchange={(e) => pickUnit(row, e.currentTarget.value as Sizing)}>
              {#each sizings as value (value)}<option {value}>{SIZING_LABEL[value]}</option>{/each}
            </select>
          </div>
        {/each}
      </div>
    {/if}

    {#if layout}
      {#if layout.direction === Direction.Grid}
        <Field label="Columns" id="auto-layout-columns">
          <input id="auto-layout-columns" class={cn(FIELD_INPUT, 'w-full')} type="number" min="1" max={MAX_GRID_COLUMNS} value={layout.columns} data-testid="auto-layout-columns" onchange={(e) => set({ columns: Math.min(MAX_GRID_COLUMNS, Math.max(1, px(e.currentTarget.value))) }, 'Changed the columns')} />
        </Field>
        <Field label="Column sizes" id="auto-layout-column-tracks">
          <input id="auto-layout-column-tracks" class={cn(FIELD_INPUT, 'w-full')} placeholder="1fr 120 hug" value={formatTracks(layout.columnTracks)} data-testid="auto-layout-column-tracks" onchange={(e) => setTracks('columnTracks', e.currentTarget.value, 'Changed the column sizes')} />
        </Field>
        <Field label="Row sizes" id="auto-layout-row-tracks">
          <input id="auto-layout-row-tracks" class={cn(FIELD_INPUT, 'w-full')} placeholder="hug" value={formatTracks(layout.rowTracks)} data-testid="auto-layout-row-tracks" onchange={(e) => setTracks('rowTracks', e.currentTarget.value, 'Changed the row sizes')} />
        </Field>
        <Field label="Fill order">
          <div class="flex min-w-0 flex-1" data-testid="auto-layout-auto-flow"><SegmentedControl label="Fill order" options={AUTO_FLOWS} value={layout.autoFlow} onchange={(v) => set({ autoFlow: v as AutoFlow }, 'Changed the fill order')} /></div>
        </Field>
      {/if}

      <div class="mt-1.5 flex items-start gap-1.5">
        <div class="grid shrink-0 grid-cols-3 gap-1 rounded-sm bg-ui-sunken p-1.5" role="group" aria-label="Alignment" data-testid="auto-layout-align">
          {#each SPOTS as row (row)}
            {#each SPOTS as column (column)}
              <button type="button" class={SPOT} aria-label={`Align ${row} ${column}`} aria-pressed={spotPressed(layout, column, row)} onclick={() => pickSpot(layout, column, row)}></button>
            {/each}
          {/each}
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <div class="flex min-w-0 items-center gap-1">
            <input aria-label="Gap" title="Gap" class={cn(FIELD_INPUT, 'w-full min-w-0')} type="number" placeholder={GAP_MODE_LABEL[GapMode.Auto]} disabled={gapMode === GapMode.Auto} value={gapMode === GapMode.Auto ? '' : layout.gap} data-testid="auto-layout-gap" onchange={(e) => set({ gap: signedPx(e.currentTarget.value) }, 'Changed the gap')} />
            <select aria-label="Gap mode" class={cn(FIELD_INPUT, 'w-14 shrink-0')} value={gapMode} data-testid="auto-layout-gap-mode" onchange={(e) => set({ justify: GAP_MODE_JUSTIFY[e.currentTarget.value as GapMode] }, 'Changed the gap')}>
              {#each GAP_MODES as mode (mode)}<option value={mode} selected={mode === gapMode}>{GAP_MODE_LABEL[mode]}</option>{/each}
            </select>
            <IconButton label="Advanced layout settings" size={IconSize.Sm} pressed={advancedOpen} data-testid="auto-layout-advanced" onclick={() => (advancedOpen = !advancedOpen)}><Settings2 /></IconButton>
          </div>
          {#if lined}
            <input aria-label="Gap between lines" class={cn(FIELD_INPUT, 'w-full')} type="number" value={layout.crossGap} onchange={(e) => set({ crossGap: signedPx(e.currentTarget.value) }, 'Changed the gap between lines')} />
          {/if}
        </div>
      </div>

      {#if layout.wrap}
        <Field label="Lines">
          <div class="flex min-w-0 flex-1" data-testid="auto-layout-align-content"><SegmentedControl label="Lines" options={LINE_SPREADS} value={layout.alignContent} onchange={(v) => set({ alignContent: v as AlignContent }, 'Changed how the lines spread')} /></div>
        </Field>
      {/if}

      <div class="mt-1.5 flex items-center gap-1.5">
        {#if perSide}
          {#each SIDES as side (side)}
            <input aria-label={`Padding ${side}`} title={SIDE_LABEL[side]} class={cn(FIELD_INPUT, 'w-full min-w-0 px-1')} type="number" min="0" value={layout.padding[side]} data-testid={`auto-layout-padding-${side}`} onchange={(e) => set({ padding: { ...layout.padding, [side]: px(e.currentTarget.value) } }, 'Changed the padding')} />
          {/each}
        {:else}
          <span class={PREFIX} aria-hidden="true"><ArrowLeftRight size={12} /></span>
          <input aria-label="Horizontal padding" title="Horizontal padding" class={cn(FIELD_INPUT, 'w-full min-w-0')} type="number" min="0" value={layout.padding.left} data-testid="auto-layout-padding-x" onchange={(e) => set({ padding: padAxis(layout.padding, HORIZONTAL_SIDES, e.currentTarget.value) }, 'Changed the padding')} />
          <span class={PREFIX} aria-hidden="true"><ArrowUpDown size={12} /></span>
          <input aria-label="Vertical padding" title="Vertical padding" class={cn(FIELD_INPUT, 'w-full min-w-0')} type="number" min="0" value={layout.padding.top} data-testid="auto-layout-padding-y" onchange={(e) => set({ padding: padAxis(layout.padding, VERTICAL_SIDES, e.currentTarget.value) }, 'Changed the padding')} />
        {/if}
        <IconButton label="Padding per side" size={IconSize.Sm} pressed={perSide} data-testid="auto-layout-padding-sides" onclick={() => toggleSides(layout.padding)}><Scan /></IconButton>
      </div>

      <label class="mt-1.5 flex items-center gap-2 text-ui-label">
        <input type="checkbox" checked={!!clip.clipContent} data-testid="stack-clip-content" onchange={(e) => commit(setClipFlags(doc, clip.id, { clipContent: e.currentTarget.checked }), 'Changed clip content')} />
        Clip content
      </label>

      {#if advancedOpen}
        <div data-testid="auto-layout-advanced-panel">
          <Field label="Distribute">
            <IconButton label="Stretch children" size={IconSize.Sm} pressed={layout.align === Align.Stretch} data-testid="auto-layout-stretch" onclick={() => set({ align: layout.align === Align.Stretch ? Align.Start : Align.Stretch }, 'Changed the alignment')}><StretchVertical /></IconButton>
            {#if layout.direction === Direction.Horizontal}
              <IconButton label="Align baselines" size={IconSize.Sm} pressed={layout.align === Align.Baseline} data-testid="auto-layout-baseline" onclick={() => set({ align: layout.align === Align.Baseline ? Align.Start : Align.Baseline }, 'Changed the alignment')}><Baseline /></IconButton>
            {/if}
            {#each SPREADS as spread (spread.justify)}
              <IconButton label={spread.label} size={IconSize.Sm} pressed={layout.justify === spread.justify} data-testid={spread.testid} onclick={() => set({ justify: layout.justify === spread.justify ? Justify.Start : spread.justify }, 'Changed the spacing')}><spread.icon /></IconButton>
            {/each}
          </Field>
          <Field label="First on top">
            <div class="flex min-w-0 flex-1" data-testid="auto-layout-first-on-top"><SegmentedField name="First on top" options={YES_NO} value={answerOf(layout.firstOnTop)} onchange={(v) => set({ firstOnTop: v === Answer.Yes }, 'Changed the stacking')} /></div>
          </Field>
          <Field label="Strokes included">
            <div class="flex min-w-0 flex-1" data-testid="auto-layout-strokes-included"><SegmentedField name="Strokes included" options={YES_NO} value={answerOf(layout.strokesIncluded)} onchange={(v) => set({ strokesIncluded: v === Answer.Yes }, 'Changed the strokes in layout')} /></div>
          </Field>
        </div>
      {/if}
    {/if}

    {#if (layout || parent) && sizeShown}
      <Field label="Min / max W">
        <input aria-label="Min width" placeholder="min" class={cn(FIELD_INPUT, 'w-full')} type="number" min="0" value={item.minWidth ?? ''} onchange={(e) => size({ minWidth: optionalPx(e.currentTarget.value) }, 'Changed the min width')} />
        <input aria-label="Max width" placeholder="max" class={cn(FIELD_INPUT, 'w-full')} type="number" min="0" value={item.maxWidth ?? ''} onchange={(e) => size({ maxWidth: optionalPx(e.currentTarget.value) }, 'Changed the max width')} />
      </Field>
      <Field label="Min / max H">
        <input aria-label="Min height" placeholder="min" class={cn(FIELD_INPUT, 'w-full')} type="number" min="0" value={item.minHeight ?? ''} onchange={(e) => size({ minHeight: optionalPx(e.currentTarget.value) }, 'Changed the min height')} />
        <input aria-label="Max height" placeholder="max" class={cn(FIELD_INPUT, 'w-full')} type="number" min="0" value={item.maxHeight ?? ''} onchange={(e) => size({ maxHeight: optionalPx(e.currentTarget.value) }, 'Changed the max height')} />
      </Field>
    {/if}

    {#if inGrid}
      <Field label="Span">
        <input aria-label="Column span" class={cn(FIELD_INPUT, 'w-full')} type="number" min="1" value={item.columnSpan} data-testid="auto-layout-column-span" onchange={(e) => size({ columnSpan: span(e.currentTarget.value) }, 'Changed the column span')} />
        <input aria-label="Row span" class={cn(FIELD_INPUT, 'w-full')} type="number" min="1" value={item.rowSpan} data-testid="auto-layout-row-span" onchange={(e) => size({ rowSpan: span(e.currentTarget.value) }, 'Changed the row span')} />
      </Field>
      <Field label="In cell">
        <select aria-label="Horizontal in cell" class={cn(FIELD_INPUT, 'w-full')} value={item.cellX ?? ''} data-testid="auto-layout-cell-x" onchange={(e) => size({ cellX: cellAlign(e.currentTarget.value) }, 'Aligned in the cell')}>
          {#each CELL_ALIGNS as value (value)}<option {value}>{CELL_ALIGN_LABEL[value]}</option>{/each}
        </select>
        <select aria-label="Vertical in cell" class={cn(FIELD_INPUT, 'w-full')} value={item.cellY ?? ''} data-testid="auto-layout-cell-y" onchange={(e) => size({ cellY: cellAlign(e.currentTarget.value) }, 'Aligned in the cell')}>
          {#each CELL_ALIGNS as value (value)}<option {value}>{CELL_ALIGN_LABEL[value]}</option>{/each}
        </select>
      </Field>
    {/if}

    {#if parent && !inGrid && !item.absolute}
      <Field label="Align self">
        <select aria-label="Align self" class={cn(FIELD_INPUT, 'w-full')} value={item.alignSelf ?? ''} data-testid="stack-align-self" onchange={(e) => size({ alignSelf: cellAlign(e.currentTarget.value) }, 'Aligned in the stack')}>
          {#each SELF_ALIGNS as value (value)}<option {value}>{SELF_ALIGN_LABEL[value]}</option>{/each}
        </select>
      </Field>
    {/if}

    {#if parent}
      <Field label="In layout">
        <div class="flex min-w-0 flex-1" data-testid="auto-layout-absolute"><SegmentedField name="Absolute position" options={YES_NO} value={answerOf(item.absolute)} onchange={(v) => size({ absolute: v === Answer.Yes }, 'Changed absolute position')} /></div>
        <IconButton label="Move earlier" size={IconSize.Sm} disabled={place <= 0} onclick={() => commit(reorderChild(doc, parent.id, clip.id, place - 1), 'Reordered in the stack')}><ChevronUp /></IconButton>
        <IconButton label="Move later" size={IconSize.Sm} disabled={place < 0 || place >= siblings.length - 1} onclick={() => commit(reorderChild(doc, parent.id, clip.id, place + 1), 'Reordered in the stack')}><ChevronDown /></IconButton>
        <IconButton label="Take out of the stack" size={IconSize.Sm} data-testid="auto-layout-leave" onclick={() => commit(leaveStack(doc, clip.id), 'Took the clip out of the stack')}><LogOut /></IconButton>
      </Field>
    {/if}
</div>
