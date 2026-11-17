<script lang="ts">
  import { GRID_COLOUR, gridAlpha, gridStops } from '$lib/canvas/core/pixel-grid';
  import type { Viewport } from '$lib/canvas/dot-grid';

  let { view, area, on, moving }: { view: Viewport; area: { width: number; height: number }; on: boolean; moving: boolean } = $props();

  const LINE_CSS_PX = 1;

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    const el = canvas;
    if (!el || moving) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    el.width = Math.round(area.width * ratio);
    el.height = Math.round(area.height * ratio);
    const ctx = el.getContext('2d');
    const alpha = on ? gridAlpha(view.zoom) : 0;
    if (!ctx || alpha === 0) {
      return;
    }

    ctx.scale(ratio, ratio);
    ctx.fillStyle = `rgba(${GRID_COLOUR}, ${alpha})`;
    for (const x of gridStops(view.x, view.zoom, area.width)) {
      ctx.fillRect(x - LINE_CSS_PX / 2, 0, LINE_CSS_PX, area.height);
    }
    for (const y of gridStops(view.y, view.zoom, area.height)) {
      ctx.fillRect(0, y - LINE_CSS_PX / 2, area.width, LINE_CSS_PX);
    }
  });
</script>

<canvas class="pixel-grid" class:moving data-testid="pixel-grid-canvas" bind:this={canvas} aria-hidden="true"></canvas>

<style>
  .pixel-grid {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
  }

  .moving {
    visibility: hidden;
  }
</style>
