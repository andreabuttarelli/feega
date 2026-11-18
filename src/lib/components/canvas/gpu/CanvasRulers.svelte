<script lang="ts">
  import { canvasGuides } from '$lib/canvas/canvas-guides.svelte';
  import { rulerMarks, type CanvasGuide } from '$lib/canvas/canvas-rulers';
  import type { Viewport } from '$lib/canvas/dot-grid';
  import { GuideAxis } from '$lib/canvas/user-guides';

  type Drag = { axis: GuideAxis; screen: number; from: CanvasGuide | null };

  let { view, area }: { view: Viewport; area: { width: number; height: number } } = $props();

  const RULER_PX = 18;
  const GRAB_PX = 4;
  const LABEL_PAD = 3;
  const FONT = '10px ui-monospace, monospace';
  const GUIDE_COLOUR = '#0d99ff';
  const RULER_FILL = 'rgba(250, 250, 250, 0.92)';
  const RULER_INK = '#6e6e73';

  let canvas = $state<HTMLCanvasElement | null>(null);
  let drag = $state<Drag | null>(null);

  const offsetOf = (axis: GuideAxis) => (axis === GuideAxis.Vertical ? view.x : view.y);
  const screenOf = (g: CanvasGuide) => offsetOf(g.axis) + g.at * view.zoom;
  const worldOf = (axis: GuideAxis, screen: number) => Math.round((screen - offsetOf(axis)) / view.zoom);

  function shown(): { axis: GuideAxis; screen: number }[] {
    const kept = canvasGuides.list.filter((g) => !drag?.from || g.axis !== drag.from.axis || g.at !== drag.from.at).map((g) => ({ axis: g.axis, screen: screenOf(g) }));
    return drag ? [...kept, { axis: drag.axis, screen: drag.screen }] : kept;
  }

  $effect(() => {
    const el = canvas;
    if (!el) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    el.width = Math.round(area.width * ratio);
    el.height = Math.round(area.height * ratio);
    const ctx = el.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.scale(ratio, ratio);
    ctx.strokeStyle = GUIDE_COLOUR;
    ctx.lineWidth = 1;
    for (const g of shown()) {
      ctx.beginPath();
      if (g.axis === GuideAxis.Vertical) {
        ctx.moveTo(Math.round(g.screen) + 0.5, 0);
        ctx.lineTo(Math.round(g.screen) + 0.5, area.height);
      } else {
        ctx.moveTo(0, Math.round(g.screen) + 0.5);
        ctx.lineTo(area.width, Math.round(g.screen) + 0.5);
      }
      ctx.stroke();
    }

    ctx.fillStyle = RULER_FILL;
    ctx.fillRect(0, 0, area.width, RULER_PX);
    ctx.fillRect(0, 0, RULER_PX, area.height);
    ctx.fillStyle = RULER_INK;
    ctx.strokeStyle = RULER_INK;
    ctx.font = FONT;
    ctx.textBaseline = 'top';
    for (const m of rulerMarks(view.x, view.zoom, area.width)) {
      ctx.beginPath();
      ctx.moveTo(Math.round(m.screen) + 0.5, 0);
      ctx.lineTo(Math.round(m.screen) + 0.5, RULER_PX);
      ctx.stroke();
      ctx.fillText(m.label, m.screen + LABEL_PAD, 2);
    }
    for (const m of rulerMarks(view.y, view.zoom, area.height)) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(m.screen) + 0.5);
      ctx.lineTo(RULER_PX, Math.round(m.screen) + 0.5);
      ctx.stroke();
      ctx.save();
      ctx.translate(2, m.screen - LABEL_PAD);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'top';
      ctx.fillText(m.label, 0, 0);
      ctx.restore();
    }
    if (drag) {
      const label = String(worldOf(drag.axis, drag.screen));
      ctx.fillStyle = GUIDE_COLOUR;
      ctx.fillText(label, drag.axis === GuideAxis.Vertical ? drag.screen + LABEL_PAD : RULER_PX + LABEL_PAD, drag.axis === GuideAxis.Vertical ? RULER_PX + LABEL_PAD : drag.screen + LABEL_PAD);
    }
  });

  function pointOf(e: PointerEvent, axis: GuideAxis): number {
    const rect = canvas!.getBoundingClientRect();
    return axis === GuideAxis.Vertical ? e.clientX - rect.left : e.clientY - rect.top;
  }

  function grab(e: PointerEvent, axis: GuideAxis) {
    e.preventDefault();
    e.stopPropagation();
    const at = pointOf(e, axis);
    const near = canvasGuides.list.find((g) => g.axis === axis && Math.abs(screenOf(g) - at) <= GRAB_PX) ?? null;
    drag = { axis, screen: near ? screenOf(near) : at, from: near };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop, { once: true });
  }

  function move(e: PointerEvent) {
    if (drag) {
      drag = { ...drag, screen: pointOf(e, drag.axis) };
    }
  }

  function drop() {
    window.removeEventListener('pointermove', move);
    const done = drag;
    drag = null;
    if (!done) {
      return;
    }

    if (done.screen <= RULER_PX) {
      if (done.from) {
        canvasGuides.remove(done.from);
      }
      return;
    }

    const at = worldOf(done.axis, done.screen);
    if (done.from) {
      canvasGuides.move(done.from, at);
      return;
    }
    canvasGuides.add({ axis: done.axis, at });
  }
</script>

<canvas class="canvas-rulers" data-testid="canvas-rulers" bind:this={canvas} aria-hidden="true"></canvas>
<div class="strip top" role="presentation" data-testid="canvas-ruler-top" style:height={`${RULER_PX}px`} onpointerdown={(e) => grab(e, GuideAxis.Horizontal)}></div>
<div class="strip left" role="presentation" data-testid="canvas-ruler-left" style:width={`${RULER_PX}px`} onpointerdown={(e) => grab(e, GuideAxis.Vertical)}></div>

<style>
  .canvas-rulers {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 3;
  }

  .strip {
    position: absolute;
    z-index: 4;
  }

  .top {
    left: 0;
    right: 0;
    top: 0;
    cursor: ns-resize;
  }

  .left {
    left: 0;
    top: 0;
    bottom: 0;
    cursor: ew-resize;
  }
</style>
