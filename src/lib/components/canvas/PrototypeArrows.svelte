<script lang="ts">
  import type { Viewport } from '$lib/canvas/dot-grid';
  import type { PrototypeLink } from '$lib/motion/prototype/links';
  import { TRIGGER_LABEL } from '@feega/motion-core/motion/prototype/model';
  import { arrowsFor, curveBetween, draftFrom, type ArrowFrame } from '$lib/canvas/prototype-arrows';

  let { view, frames, links, aimingFrom = null }: { view: Viewport; frames: ArrowFrame[]; links: PrototypeLink[]; aimingFrom?: string | null } = $props();

  let layer = $state<SVGSVGElement | null>(null);
  let pointer = $state<{ x: number; y: number } | null>(null);

  const arrows = $derived(arrowsFor(links, frames, view));
  const labelOf = (id: string) => TRIGGER_LABEL[links.find((l) => `${l.from}:${l.id}` === id)!.trigger];
  const start = $derived(aimingFrom ? draftFrom(frames, aimingFrom, view) : null);
  const band = $derived(start && pointer ? curveBetween(start, pointer) : null);

  function track(e: PointerEvent) {
    const box = layer?.getBoundingClientRect();
    pointer = box ? { x: e.clientX - box.left, y: e.clientY - box.top } : null;
  }
</script>

<svelte:window onpointermove={aimingFrom ? track : null} />

<svg bind:this={layer} class="arrows" data-testid="prototype-arrows" aria-hidden="true">
  {#each arrows as arrow (arrow.id)}
    <g class="arrow" data-from={arrow.from} data-to={arrow.to}>
      <path d={arrow.path} />
      <polygon points={arrow.head} />
      <text x={arrow.label.x} y={arrow.label.y - 6} text-anchor="middle">{labelOf(arrow.id)}</text>
    </g>
  {/each}
  {#if band}
    <g class="arrow draft" data-testid="prototype-draft-arrow">
      <path d={band.path} />
      <polygon points={band.head} />
    </g>
  {/if}
</svg>

<style>
  .arrows {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
    z-index: 3;
  }

  .arrow path {
    fill: none;
    stroke: var(--ui-accent, #0d99ff);
    stroke-width: 2;
  }

  .arrow polygon {
    fill: var(--ui-accent, #0d99ff);
  }

  .arrow text {
    fill: var(--ui-accent, #0d99ff);
    font-size: 11px;
    font-weight: 600;
    paint-order: stroke;
    stroke: var(--ui-surface, #fff);
    stroke-width: 3px;
  }

  .draft path {
    stroke-dasharray: 6 4;
  }
</style>
