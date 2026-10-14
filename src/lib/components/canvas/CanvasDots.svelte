<script lang="ts">
  import { useStore } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import { dotGrid } from '$lib/canvas/dot-grid';

  const DARK_SCHEME = '(prefers-color-scheme: dark)';

  const store = useStore();
  let canvas: HTMLCanvasElement;
  let tile: HTMLCanvasElement | undefined;
  let frame = 0;

  function draw() {
    frame = 0;
    const dpr = devicePixelRatio;
    const width = store.width;
    const height = store.height;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const context = canvas.getContext('2d')!;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const grid = dotGrid(store.viewport);
    if (!grid) {
      return;
    }

    const tileSize = Math.max(1, Math.round(grid.step * dpr));
    const pattern = context.createPattern(dotTile(tileSize, grid.radius * dpr), 'repeat')!;
    const scale = (grid.step * dpr) / tileSize;
    pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, (grid.first.x - grid.step / 2) * dpr, (grid.first.y - grid.step / 2) * dpr]));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = pattern;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function dotTile(size: number, radius: number): HTMLCanvasElement {
    tile ??= document.createElement('canvas');
    tile.width = size;
    tile.height = size;
    const context = tile.getContext('2d')!;
    context.fillStyle = getComputedStyle(canvas).color;
    context.beginPath();
    context.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    context.fill();
    return tile;
  }

  function schedule() {
    if (!frame && canvas) {
      frame = requestAnimationFrame(draw);
    }
  }

  $effect(() => {
    void store.viewport;
    void store.width;
    void store.height;
    schedule();
  });

  onMount(() => {
    const scheme = matchMedia(DARK_SCHEME);
    scheme.addEventListener('change', schedule);
    const theme = new MutationObserver(schedule);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => {
      cancelAnimationFrame(frame);
      scheme.removeEventListener('change', schedule);
      theme.disconnect();
    };
  });
</script>

<canvas bind:this={canvas} class="svelte-flow__background svelte-flow__container dots" data-testid="svelte-flow__background"></canvas>

<style>
  .dots {
    color: var(--xy-background-pattern-color, var(--xy-background-pattern-color-default));
  }
</style>
