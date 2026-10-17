<script lang="ts">
  import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/svelte';
  import { WIRE_MODE_LOOK, type WireEdgeData } from '$lib/canvas-edges';

  const ICON_SIZE = 14;
  const BADGE_RADIUS = 11;

  let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, interactionWidth, data }: EdgeProps =
    $props();

  const look = $derived(WIRE_MODE_LOOK[(data as WireEdgeData | undefined)?.mode ?? 'fixed']);
  const geometry = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }));
  const path = $derived(geometry[0]);
  const midX = $derived(geometry[1]);
  const midY = $derived(geometry[2]);
</script>

<BaseEdge {id} {path} {markerEnd} {style} {interactionWidth} class={look.edgeClass ?? undefined} />

{#if look.icon}
  {@const Icon = look.icon}
  <g class="wire-iterate-badge" data-testid="wire-iterate-icon" transform="translate({midX} {midY})" pointer-events="none">
    <circle r={BADGE_RADIUS} />
    <Icon x={-ICON_SIZE / 2} y={-ICON_SIZE / 2} width={ICON_SIZE} height={ICON_SIZE} />
  </g>
{/if}

<style>
  :global(.svelte-flow__edge-path.wire-iterate) {
    stroke: var(--ui-wire-iterate);
    stroke-dasharray: 6 4;
  }

  .wire-iterate-badge circle {
    fill: var(--ui-panel-raised);
    stroke: var(--ui-wire-iterate);
    stroke-width: 1.5;
  }

  .wire-iterate-badge :global(svg) {
    color: var(--ui-wire-iterate);
  }
</style>
