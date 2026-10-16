<script lang="ts">
  import DrawOverlay from '$lib/components/motion/DrawOverlay.svelte';
  import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
  import { DrawTool } from '$lib/motion/draw-tool';
  import { CanvasTheme, type CanvasBox, type DrawnWire } from '$lib/motion/draw-create';
  import type { OpResult } from '$lib/motion/timeline';
  import { drawnOnCanvas } from '$lib/canvas/canvas-draw';

  type Point = { x: number; y: number };
  type FrameAt = { box: CanvasBox } | { at: Point };

  let { tool, toFlow, ondraw, onframe }: { tool: DrawTool; toFlow: (screen: Point) => Point; ondraw: (drawn: DrawnWire) => void; onframe: (target: FrameAt) => void } = $props();

  const framing = $derived(tool === DrawTool.Frame);
  const overlayTool = $derived(framing ? DrawTool.Rectangle : tool);
  let placed = false;

  let host = $state<HTMLDivElement | null>(null);
  let size = $state({ width: 1, height: 1 });
  let made = $state.raw<OpResult | null>(null);

  const sheet = $derived({ ...newMotionDoc(MotionFormat.Landscape), width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) });

  const themeOf = (): CanvasTheme => (document.documentElement.dataset.theme === CanvasTheme.Dark ? CanvasTheme.Dark : CanvasTheme.Light);

  function created(id: string) {
    const rect = host?.getBoundingClientRect();
    const found = made?.ok && rect ? findClip(made.doc, id) : null;
    const drawn = found && rect ? drawnOnCanvas(found.clip, { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, toFlow, themeOf()) : null;
    made = null;
    placed = true;
    if (drawn && framing && 'box' in drawn) {
      onframe({ box: drawn.box });
      return;
    }
    if (drawn) {
      ondraw(drawn);
    }
  }

  function released(e: PointerEvent) {
    if (framing && !placed) {
      onframe({ at: toFlow({ x: e.clientX, y: e.clientY }) });
    }
    placed = false;
  }
</script>

<div class="canvas-draw" data-testid="canvas-draw" bind:this={host} bind:clientWidth={size.width} bind:clientHeight={size.height} onpointerup={released} role="presentation">
  <DrawOverlay doc={sheet} frame={0} tool={overlayTool} onchange={(result) => (made = result)} oncreated={created} />
</div>

<style>
  .canvas-draw {
    position: absolute;
    inset: 0;
    z-index: 5;
  }
</style>
