<script lang="ts">
  import { onMount } from 'svelte';
  import { flagColour } from '../ascii-field';
  import { densityAt, glyphAt, type Cover } from './cover';

  let { cover, label }: { cover: Cover; label: string } = $props();

  const CELL = 16;
  const FONT = '13px ui-monospace, SFMono-Regular, Menlo, monospace';

  let canvas: HTMLCanvasElement;

  function draw() {
    const { width, height } = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.scale(ratio, ratio);
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cols = Math.floor(width / CELL);
    const rows = Math.floor(height / CELL);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) / cols;
        const y = (r + 0.5) / rows;
        const glyph = glyphAt(cover.ramp, densityAt(cover.shape, x, y));
        if (glyph === ' ') {
          continue;
        }
        const [red, green, blue] = flagColour(cover.flag, x * 0.7 + y * 0.3);
        ctx.fillStyle = `rgb(${red} ${green} ${blue})`;
        ctx.fillText(glyph, (c + 0.5) * CELL, (r + 0.5) * CELL);
      }
    }
  }

  onMount(() => {
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  });
</script>

<canvas class="ascii-cover" bind:this={canvas} aria-label={label}></canvas>

<style>
  .ascii-cover {
    display: block;
    width: 100%;
    aspect-ratio: 2 / 1;
    background: #0a0a0a;
    border-radius: 10px;
  }
</style>
