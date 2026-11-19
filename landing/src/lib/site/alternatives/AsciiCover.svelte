<script lang="ts">
  import { onMount } from 'svelte';
  import { flagColour } from '../ascii-field';
  import { densityAt, glyphAt, type Cover } from './cover';

  let { cover, label, name }: { cover: Cover; label: string; name?: string } = $props();

  const NAME_CELL = 5;
  const NAME_FONT = '800 7px ui-monospace, SFMono-Regular, Menlo, monospace';
  const NAME_GLYPHS = '#';
  const NAME_WIDTH = 0.8;
  const BACKDROP_ALPHA = 0.18;

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

    ctx.globalAlpha = name ? BACKDROP_ALPHA : 1;

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

    ctx.globalAlpha = 1;
    if (name) {
      drawName(ctx, name, width, height);
    }
  }

  function nameMask(text: string, cols: number, rows: number): Uint8ClampedArray | null {
    const mask = document.createElement('canvas');
    mask.width = cols;
    mask.height = rows;
    const m = mask.getContext('2d', { willReadFrequently: true });
    if (!m) {
      return null;
    }

    let size = rows;
    m.font = `900 ${size}px system-ui, sans-serif`;
    size = Math.min(rows * 0.6, (size * cols * NAME_WIDTH) / m.measureText(text).width);
    m.font = `900 ${size}px system-ui, sans-serif`;
    m.textAlign = 'center';
    m.textBaseline = 'middle';
    m.fillText(text, cols / 2, rows / 2);
    return m.getImageData(0, 0, cols, rows).data;
  }

  function drawName(ctx: CanvasRenderingContext2D, text: string, width: number, height: number) {
    const cols = Math.floor(width / NAME_CELL);
    const rows = Math.floor(height / NAME_CELL);
    const alpha = nameMask(text, cols, rows);
    if (!alpha) {
      return;
    }

    ctx.font = NAME_FONT;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = alpha[(r * cols + c) * 4 + 3];
        if (a < 128) {
          continue;
        }
        const [red, green, blue] = flagColour(cover.flag, c / cols);
        ctx.fillStyle = `rgb(${red} ${green} ${blue})`;
        ctx.fillText(NAME_GLYPHS[(r + c) % NAME_GLYPHS.length], (c + 0.5) * NAME_CELL, (r + 0.5) * NAME_CELL);
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
</div>

<style>
  .ascii-cover {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 1;
    background: #121212;
    border-radius: 10px;
    overflow: hidden;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

</style>
