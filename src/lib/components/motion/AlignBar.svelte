<script lang="ts">
  import type { Component } from 'svelte';
  import AlignStartVertical from '@lucide/svelte/icons/align-start-vertical';
  import AlignCenterVertical from '@lucide/svelte/icons/align-center-vertical';
  import AlignEndVertical from '@lucide/svelte/icons/align-end-vertical';
  import AlignStartHorizontal from '@lucide/svelte/icons/align-start-horizontal';
  import AlignCenterHorizontal from '@lucide/svelte/icons/align-center-horizontal';
  import AlignEndHorizontal from '@lucide/svelte/icons/align-end-horizontal';
  import AlignHorizontalDistributeCenter from '@lucide/svelte/icons/align-horizontal-distribute-center';
  import AlignVerticalDistributeCenter from '@lucide/svelte/icons/align-vertical-distribute-center';
  import { Axis, Edge } from '$lib/motion/space';

  let { count, onalign, ondistribute }: { count: number; onalign: (edge: Edge) => void; ondistribute: (axis: Axis) => void } = $props();

  const ICON = 15;
  const MIN_DISTRIBUTED = 3;

  const ALIGNS: { edge: Edge; label: string; icon: Component }[] = [
    { edge: Edge.Left, label: 'Align left', icon: AlignStartVertical },
    { edge: Edge.Center, label: 'Align centres horizontally', icon: AlignCenterVertical },
    { edge: Edge.Right, label: 'Align right', icon: AlignEndVertical },
    { edge: Edge.Top, label: 'Align top', icon: AlignStartHorizontal },
    { edge: Edge.Middle, label: 'Align middles vertically', icon: AlignCenterHorizontal },
    { edge: Edge.Bottom, label: 'Align bottom', icon: AlignEndHorizontal }
  ];

  const DISTRIBUTES: { axis: Axis; label: string; icon: Component }[] = [
    { axis: Axis.X, label: 'Distribute horizontally', icon: AlignHorizontalDistributeCenter },
    { axis: Axis.Y, label: 'Distribute vertically', icon: AlignVerticalDistributeCenter }
  ];
</script>

<div class="align" role="toolbar" aria-label={count > 1 ? 'Align the selection' : 'Align to the frame'} data-testid="align-bar">
  {#each ALIGNS as a (a.edge)}
    <button type="button" aria-label={a.label} title={a.label} data-align={a.edge} onclick={() => onalign(a.edge)}><a.icon size={ICON} /></button>
  {/each}
  {#each DISTRIBUTES as d (d.axis)}
    <button type="button" aria-label={d.label} title={d.label} data-distribute={d.axis} disabled={count < MIN_DISTRIBUTED} onclick={() => ondistribute(d.axis)}><d.icon size={ICON} /></button>
  {/each}
</div>

<style>
  .align {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: var(--ui-space-1) var(--ui-space-2) var(--ui-space-1) 24px;
    border-bottom: 1px solid var(--ui-line);
  }

  button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid transparent;
    background: none;
    color: var(--ui-ink);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: var(--ui-line-strong);
  }

  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
