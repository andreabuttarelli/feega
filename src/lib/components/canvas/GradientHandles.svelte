<script lang="ts">
  import { GradientGrip, draggedFill, gradientHandles, type Grab, type Pt } from '$lib/canvas/gradient-handles';
  import type { Fill } from '$lib/motion/fill/model';

  type Rect = { left: number; top: number; width: number; height: number };

  let { rect, fill, onchange, ondone }: { rect: Rect; fill: Fill; onchange: (fill: Fill) => void; ondone: (fill: Fill) => void } = $props();

  const size = $derived({ width: rect.width, height: rect.height });
  const handles = $derived(gradientHandles(fill, size));
  let held: { grab: Grab; fill: Fill } | null = null;

  function local(e: PointerEvent, host: Element): Pt {
    const box = host.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  }

  function start(e: PointerEvent, grab: Grab) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    held = { grab, fill };
  }

  function move(e: PointerEvent) {
    if (!held) {
      return;
    }
    const next = draggedFill(fill, size, held.grab, local(e, e.currentTarget as Element));
    held = { ...held, fill: next };
    onchange(next);
  }

  function end() {
    if (!held) {
      return;
    }
    const done = held.fill;
    held = null;
    ondone(done);
  }
</script>

{#if handles}
  <svg class="gradient" data-testid="gradient-handles" style="left:{rect.left}px;top:{rect.top}px;width:{rect.width}px;height:{rect.height}px" onpointermove={move} onpointerup={end} onpointercancel={end} role="presentation">
    <line x1={handles.start[0]} y1={handles.start[1]} x2={handles.end[0]} y2={handles.end[1]} />
    {#each handles.stops as at, i (i)}
      <circle class="stop" data-testid="gradient-stop" cx={at[0]} cy={at[1]} r="5" onpointerdown={(e) => start(e, { grip: GradientGrip.Stop, stop: i })} role="presentation" />
    {/each}
    <circle class="end" data-testid="gradient-start" cx={handles.start[0]} cy={handles.start[1]} r="6" onpointerdown={(e) => start(e, { grip: GradientGrip.Start })} role="presentation" />
    <circle class="end" data-testid="gradient-end" cx={handles.end[0]} cy={handles.end[1]} r="6" onpointerdown={(e) => start(e, { grip: GradientGrip.End })} role="presentation" />
  </svg>
{/if}

<style>
  .gradient {
    position: absolute;
    overflow: visible;
    pointer-events: none;
  }

  line {
    stroke: #fff;
    stroke-width: 1.5;
    filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.6));
  }

  circle {
    pointer-events: auto;
    cursor: grab;
    stroke: #fff;
    stroke-width: 2;
    filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.6));
  }

  .end {
    fill: var(--ui-accent, #3b82f6);
  }

  .stop {
    fill: #fff;
    stroke: var(--ui-accent, #3b82f6);
  }
</style>
