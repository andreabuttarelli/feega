<script lang="ts">
  import type { Viewport } from '$lib/canvas/dot-grid';
  import type { PrototypeLink } from '$lib/motion/prototype/links';
  import { TRIGGER_LABEL } from '@feega/motion-core/motion/prototype/model';
  import type { WorldRect } from '$lib/canvas/frame-pick';
  import { arrowsFor, curveBetween, draftFrom, elementEdge, type ArrowFrame } from '$lib/canvas/prototype-arrows';

  type Props = {
    view: Viewport;
    frames: ArrowFrame[];
    links: PrototypeLink[];
    elements?: ReadonlyMap<string, WorldRect>;
    aimingFrom?: string | null;
    handle?: WorldRect | null;
    onpick?: (link: PrototypeLink) => void;
    ondrag?: (e: PointerEvent) => void;
  };

  let { view, frames, links, elements = new Map(), aimingFrom = null, handle = null, onpick, ondrag }: Props = $props();

  let layer = $state<SVGSVGElement | null>(null);
  let pointer = $state<{ x: number; y: number } | null>(null);

  const arrows = $derived(arrowsFor(links, frames, view, elements));
  const linkOf = (id: string) => links.find((l) => `${l.from}:${l.id}` === id)!;
  const knob = $derived(handle ? elementEdge(handle, view) : null);
  const start = $derived(knob ?? (aimingFrom ? draftFrom(frames, aimingFrom, view) : null));
  const band = $derived(start && pointer ? curveBetween(start, pointer) : null);

  function track(e: PointerEvent) {
    const box = layer?.getBoundingClientRect();
    pointer = box ? { x: e.clientX - box.left, y: e.clientY - box.top } : null;
  }
</script>

<svelte:window onpointermove={aimingFrom || handle ? track : null} />

<svg bind:this={layer} class="arrows" data-testid="prototype-arrows" aria-hidden="true">
  {#each arrows as arrow (arrow.id)}
    <g class="arrow" data-testid="prototype-arrow" data-from={arrow.from} data-to={arrow.to} role="button" tabindex="-1" aria-label="Edit this prototype link" onpointerdown={(e) => e.stopPropagation()} onclick={() => onpick?.(linkOf(arrow.id))} onkeydown={() => {}}>
      <path class="hit" d={arrow.path} />
      <path d={arrow.path} />
      <polygon points={arrow.head} />
      <text x={arrow.label.x} y={arrow.label.y - 6} text-anchor="middle">{TRIGGER_LABEL[linkOf(arrow.id).trigger]}</text>
    </g>
  {/each}
  {#if knob && !aimingFrom}
    <circle class="handle" data-testid="prototype-handle" cx={knob.x} cy={knob.y} r="6" role="button" tabindex="-1" aria-label="Drag to a frame to link" onpointerdown={(e) => (e.stopPropagation(), e.preventDefault(), ondrag?.(e))} />
  {/if}
  {#if band && aimingFrom}
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

  .arrow {
    pointer-events: visiblePainted;
    cursor: pointer;
  }

  .arrow .hit {
    stroke: transparent;
    stroke-width: 12;
  }

  .handle {
    fill: var(--ui-surface, #fff);
    stroke: var(--ui-accent, #0d99ff);
    stroke-width: 2;
    pointer-events: all;
    cursor: crosshair;
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
