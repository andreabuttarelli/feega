<script lang="ts">
  import type { Component } from 'svelte';
  import AlignLeft from '@lucide/svelte/icons/text-align-start';
  import AlignCenter from '@lucide/svelte/icons/text-align-center';
  import AlignRight from '@lucide/svelte/icons/text-align-end';
  import MoveHorizontal from '@lucide/svelte/icons/move-horizontal';
  import MoveVertical from '@lucide/svelte/icons/move-vertical';
  import Maximize from '@lucide/svelte/icons/maximize';
  import { SegmentedControl } from '$lib/components/ui/shell';
  import { SegmentIcon, type Segment } from '$lib/motion/segments';

  let { name, options, value, onchange }: { name: string; options: Segment[]; value: string; onchange: (value: string) => void } = $props();

  const ICONS: Record<SegmentIcon, Component> = {
    [SegmentIcon.AlignLeft]: AlignLeft,
    [SegmentIcon.AlignCenter]: AlignCenter,
    [SegmentIcon.AlignRight]: AlignRight,
    [SegmentIcon.AutoWidth]: MoveHorizontal,
    [SegmentIcon.AutoHeight]: MoveVertical,
    [SegmentIcon.FixedSize]: Maximize
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
