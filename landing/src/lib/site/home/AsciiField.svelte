<script lang="ts">
  import { onMount } from 'svelte';
  import { FLAG_COUNT, FieldFit, envelope, fieldAt, flagTint, glyphFor, gridSize } from '../ascii-field';

  const LOOP_MS = 24000;
  const FRAME_MS = 1000 / 30;
  const MAX_DPR = 2;
  const DESKTOP_CELL = 14;
  const MOBILE_CELL = 11;
  const MOBILE_MAX = 810;
  const SCALE = 0.09;
  const TINT_STEPS = 64;
  const EDGE_FLOOR = 0.6;

  let { fit = FieldFit.Hero }: { fit?: FieldFit } = $props();

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let grid = { cols: 0, rows: 0, cell: DESKTOP_CELL };
    let visible = true;
    let raf = 0;
    let last = 0;
    const startFlag = Math.floor(Math.random() * FLAG_COUNT);
    const t0 = performance.now();

    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      grid = gridSize(width, height, width < MOBILE_MAX ? MOBILE_CELL : DESKTOP_CELL);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${grid.cell}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    };

    const palette = (clockMs: number) =>
      Array.from({ length: TINT_STEPS }, (_, i) => {
        const [r, g, b] = flagTint(i / (TINT_STEPS - 1), clockMs, startFlag);
        return `rgb(${r},${g},${b})`;
      });

    const draw = (now: number) => {
      const phase = (now % LOOP_MS) / LOOP_MS;
      const colours = palette(still ? 0 : now - t0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { cols, rows, cell } = grid;

      for (let c = 0; c < cols; c++) {
        const nx = (c + 0.5) / cols;

        for (let row = 0; row < rows; row++) {
          const ny = (row + 0.5) / rows;
          const e = envelope(nx, ny);
          const d = Math.sqrt(fieldAt(c * cell * SCALE, row * cell * SCALE, phase)) * (EDGE_FLOOR + (1 - EDGE_FLOOR) * e);
          const glyph = glyphFor(d);
          if (glyph === ' ') {
            continue;
          }

          ctx.fillStyle = colours[Math.round((1 - e) * (TINT_STEPS - 1))];
          ctx.globalAlpha = 0.3 + d * 0.45;
          ctx.fillText(glyph, c * cell + cell / 2, row * cell + cell / 2);
        }
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) {
        return;
      }

      last = now;
      draw(now);
    };

    const sync = () => {
      cancelAnimationFrame(raf);
      if (still || !visible || document.hidden) {
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });

    const ro = new ResizeObserver(() => {
      size();
      draw(performance.now());
    });

    const start = () => {
      size();
      draw(t0);
      canvas.classList.add('on');
      ro.observe(canvas);
      io.observe(canvas);
      document.addEventListener('visibilitychange', sync);
    };

    if (document.readyState === 'complete') {
      start();
    } else {
      addEventListener('load', start, { once: true });
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      removeEventListener('load', start);
      document.removeEventListener('visibilitychange', sync);
    };
  });
</script>

<div class="field" data-fit={fit} aria-hidden="true">
  <canvas bind:this={canvas}></canvas>
  {#if fit === FieldFit.Hero}
    <div class="fade"></div>
  {/if}
</div>

<style>
  .field {
    position: absolute;
    top: 0;
    left: 50%;
    z-index: 0;
    width: 100vw;
    height: 760px;
    overflow: hidden;
    transform: translateX(-50%);
    pointer-events: none;
  }

  [data-fit='box'] {
    inset: 0;
    width: auto;
    height: auto;
    transform: none;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 1.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  canvas:global(.on) {
    opacity: 1;
  }

  .fade {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 42% 22% at 50% 34%, rgb(0 0 0 / 0.6), rgb(0 0 0 / 0) 100%),
      linear-gradient(to bottom, rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 0) 55%, #000 100%);
  }

  @media (max-width: 809.98px) {
    .field {
      height: 640px;
    }
  }
</style>
