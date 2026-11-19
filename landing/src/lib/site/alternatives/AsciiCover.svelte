<script lang="ts">
  import { onMount } from 'svelte';
  import { flagColour } from '../ascii-field';
  import { densityAt, glyphAt, type Cover } from './cover';
  import { LOGOS, type LogoKey } from './logos';

  let { cover, label, logo }: { cover: Cover; label: string; logo?: LogoKey } = $props();

  const LOGO_SIZE = 72;

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

<div class="ascii-cover">
  <canvas bind:this={canvas} aria-label={label}></canvas>
  {#if logo}
    <div class="pair" aria-hidden="true">
      <svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox={LOGOS[logo].viewBox} fill="currentColor"><path d={LOGOS[logo].d} fill-rule="evenodd" /></svg>
    </div>
  {/if}
</div>

<style>
  .ascii-cover {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 1;
    background: #0a0a0a;
    border-radius: 10px;
    overflow: hidden;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .pair {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: radial-gradient(closest-side, rgb(10 10 10 / 0.85), rgb(10 10 10 / 0));
  }
</style>
