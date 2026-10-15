<script lang="ts">
  import DrawOverlay from '$lib/components/motion/DrawOverlay.svelte';
  import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
  import type { DrawTool } from '$lib/motion/draw-tool';
  import type { DrawnWire } from '$lib/motion/draw-create';
  import type { OpResult } from '$lib/motion/timeline';
  import { drawnOnCanvas } from '$lib/canvas/canvas-draw';

  type Point = { x: number; y: number };

  let { tool, toFlow, ondraw }: { tool: DrawTool; toFlow: (screen: Point) => Point; ondraw: (drawn: DrawnWire) => void } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let size = $state({ width: 1, height: 1 });
  let made = $state.raw<OpResult | null>(null);

  const sheet = $derived({ ...newMotionDoc(MotionFormat.Landscape), width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) });

  function created(id: string) {
    const rect = host?.getBoundingClientRect();
    const found = made?.ok && rect ? findClip(made.doc, id) : null;
    const drawn = found && rect ? drawnOnCanvas(found.clip, { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, toFlow) : null;
    made = null;
    if (drawn) {
      ondraw(drawn);
    }
  }
</script>

<div class="canvas-draw" data-testid="canvas-draw" bind:this={host} bind:clientWidth={size.width} bind:clientHeight={size.height}>
  <DrawOverlay doc={sheet} frame={0} {tool} onchange={(result) => (made = result)} oncreated={created} />
</div>

<style>
  .canvas-draw {
    position: absolute;
    inset: 0;
    z-index: 5;
  }
</style>
