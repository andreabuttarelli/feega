<script lang="ts">
  import type { Component } from 'svelte';
  import AlignLeft from '@lucide/svelte/icons/text-align-start';
  import AlignCenter from '@lucide/svelte/icons/text-align-center';
  import AlignRight from '@lucide/svelte/icons/text-align-end';
  import AlignJustify from '@lucide/svelte/icons/text-align-justify';
  import AlignTop from '@lucide/svelte/icons/align-vertical-justify-start';
  import AlignMiddle from '@lucide/svelte/icons/align-vertical-justify-center';
  import AlignBottom from '@lucide/svelte/icons/align-vertical-justify-end';
  import MoveHorizontal from '@lucide/svelte/icons/move-horizontal';
  import MoveVertical from '@lucide/svelte/icons/move-vertical';
  import Maximize from '@lucide/svelte/icons/maximize';
  import AsTyped from '@lucide/svelte/icons/type';
  import CaseUpper from '@lucide/svelte/icons/case-upper';
  import CaseLower from '@lucide/svelte/icons/case-lower';
  import CaseTitle from '@lucide/svelte/icons/case-sensitive';
  import SmallCaps from './SmallCapsIcon.svelte';
  import { SegmentedControl } from '$lib/components/ui/shell';
  import { SegmentIcon, type Segment } from '$lib/motion/segments';

  let { name, options, value, onchange }: { name: string; options: Segment[]; value: string; onchange: (value: string) => void } = $props();

  const ICONS: Record<SegmentIcon, Component> = {
    [SegmentIcon.AlignLeft]: AlignLeft,
    [SegmentIcon.AlignCenter]: AlignCenter,
    [SegmentIcon.AlignRight]: AlignRight,
    [SegmentIcon.Justify]: AlignJustify,
    [SegmentIcon.Top]: AlignTop,
    [SegmentIcon.Middle]: AlignMiddle,
    [SegmentIcon.Bottom]: AlignBottom,
    [SegmentIcon.AutoWidth]: MoveHorizontal,
    [SegmentIcon.AutoHeight]: MoveVertical,
    [SegmentIcon.FixedSize]: Maximize,
    [SegmentIcon.AsTyped]: AsTyped,
    [SegmentIcon.Upper]: CaseUpper,
    [SegmentIcon.Lower]: CaseLower,
    [SegmentIcon.Title]: CaseTitle,
    [SegmentIcon.SmallCaps]: SmallCaps
  };

  const shown = $derived(options.map((o) => ({ value: o.value, label: o.label, icon: o.icon ? ICONS[o.icon] : undefined })));
</script>

<div class="segmented" data-segmented={name}>
  <SegmentedControl label={name} options={shown} {value} {onchange} class="w-full" />
</div>

<style>
  .segmented {
    display: flex;
    flex: 1;
    min-width: 0;
  }
</style>
