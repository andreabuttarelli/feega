<script lang="ts">
  import StretchVertical from '@lucide/svelte/icons/stretch-vertical';
  import Baseline from '@lucide/svelte/icons/baseline';
  import SpaceAround from '@lucide/svelte/icons/align-horizontal-space-around';
  import SpaceEvenly from '@lucide/svelte/icons/align-horizontal-distribute-center';
  import { FIELD_INPUT, Field, IconButton, IconSize, SegmentedControl, type SegmentOption } from '$lib/components/ui/shell';
  import { cn } from '$lib/utils.js';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { Align, AlignContent, AutoFlow, Direction, Justify } from '@feega/motion-core/motion/layout/auto-layout';
  import type { AutoLayout } from '@feega/motion-core/motion/layout/model';
  import { formatTracks, parseTracks } from '$lib/motion/layout/tracks-text';
  import { setAutoLayout } from '$lib/motion/layout/ops';
  import { Answer, YES_NO, answerOf } from '$lib/motion/segments';
  import SegmentedField from './SegmentedField.svelte';

  let { doc, clip, commit }: { doc: MotionDoc; clip: MotionClip & { autoLayout: AutoLayout }; commit: (result: OpResult, summary: string) => void } = $props();

  const Stacking = { First: 'first', Last: 'last' } as const;
  const STACKINGS: SegmentOption[] = [
    { value: Stacking.First, label: 'First on top' },
    { value: Stacking.Last, label: 'Last on top' }
  ];
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

  const layout = $derived(clip.autoLayout);

  const set = (patch: Partial<AutoLayout>, summary: string) => commit(setAutoLayout(doc, clip.id, patch), summary);
  const flip = (align: Align) => set({ align: layout.align === align ? Align.Start : align }, 'Changed the alignment');

  function setTracks(key: 'columnTracks' | 'rowTracks', text: string, summary: string) {
    const tracks = parseTracks(text);
    if (tracks) {
      set({ [key]: tracks }, summary);
    }
  }
</script>

<div class="flex flex-col gap-1" data-testid="auto-layout-advanced-panel">
  <Field label="Canvas stacking">
    <div class="flex min-w-0 flex-1" data-testid="auto-layout-first-on-top"><SegmentedControl label="Canvas stacking" options={STACKINGS} value={layout.firstOnTop ? Stacking.First : Stacking.Last} onchange={(v) => set({ firstOnTop: v === Stacking.First }, 'Changed the stacking')} /></div>
  </Field>
  <Field label="Strokes included">
    <div class="flex min-w-0 flex-1" data-testid="auto-layout-strokes-included"><SegmentedField name="Strokes included" options={YES_NO} value={answerOf(layout.strokesIncluded)} onchange={(v) => set({ strokesIncluded: v === Answer.Yes }, 'Changed the strokes in layout')} /></div>
  </Field>
  <Field label="Children">
    <IconButton label="Stretch children" size={IconSize.Sm} pressed={layout.align === Align.Stretch} data-testid="auto-layout-stretch" onclick={() => flip(Align.Stretch)}><StretchVertical /></IconButton>
    {#if layout.direction === Direction.Horizontal}
      <IconButton label="Align baselines" size={IconSize.Sm} pressed={layout.align === Align.Baseline} data-testid="auto-layout-baseline" onclick={() => flip(Align.Baseline)}><Baseline /></IconButton>
    {/if}
    {#each SPREADS as spread (spread.justify)}
      <IconButton label={spread.label} size={IconSize.Sm} pressed={layout.justify === spread.justify} data-testid={spread.testid} onclick={() => set({ justify: layout.justify === spread.justify ? Justify.Start : spread.justify }, 'Changed the spacing')}><spread.icon /></IconButton>
    {/each}
  </Field>
  {#if layout.wrap}
    <Field label="Lines">
      <div class="flex min-w-0 flex-1" data-testid="auto-layout-align-content"><SegmentedControl label="Lines" options={LINE_SPREADS} value={layout.alignContent} onchange={(v) => set({ alignContent: v as AlignContent }, 'Changed how the lines spread')} /></div>
    </Field>
  {/if}
  {#if layout.direction === Direction.Grid}
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
</div>
