<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { GpuScene, themeOf, type Card } from '$lib/canvas/gpu/scene';
  import { Backend } from '$lib/canvas/gpu/backend';
  import { faceOf } from '$lib/canvas/gpu/card-face';
  import { BACKENDS, FullBackend } from '$lib/motion/gpu-full/backends';
  import { loadFonts } from '$lib/motion/gpu-full/text/load';
  import type { MotionDoc } from '$lib/motion/doc';
  import { cardItems, type CoreCard } from '$lib/canvas/core/cards';
  import { glyphsOf } from '$lib/canvas/core/glyphs';
  import { ssim, type Pixels } from '$lib/canvas/core/ssim';
  import { PARITY_SAMPLES } from '$lib/canvas/core/parity-samples';
  import { rgbaOf } from '$lib/motion/gpu-full/rgba';

  const COLUMNS = 4;
  const CARD = { w: 240, h: 160 };
  const CELL = { w: 300, h: 220 };
  const MARGIN = 30;
  const WEIGHT = 400;
  const BOLD = 600;
  const EMPTY_DOC = { tracks: [], fonts: [] } as unknown as MotionDoc;

  const kinds = Object.keys(PARITY_SAMPLES) as (keyof typeof PARITY_SAMPLES)[];
  const width = COLUMNS * CELL.w;
  const height = Math.ceil(kinds.length / COLUMNS) * CELL.h;
  const backend = (page.url.searchParams.get('backend') as FullBackend) ?? FullBackend.WebGl2;

  let reference: HTMLDivElement;
  let core: HTMLCanvasElement;
  let scores = $state<{ kind: string; score: number }[]>([]);

  const placed = (i: number) => ({ x: MARGIN + (i % COLUMNS) * CELL.w, y: MARGIN + Math.floor(i / COLUMNS) * CELL.h, ...CARD });

  function crop(source: CanvasImageSource, b: { x: number; y: number; w: number; h: number }): Pixels {
    const c = document.createElement('canvas');
    c.width = b.w;
    c.height = b.h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(source, b.x * scale(source), b.y * scale(source), b.w * scale(source), b.h * scale(source), 0, 0, b.w, b.h);
    return ctx.getImageData(0, 0, b.w, b.h);
  }

  const scale = (source: CanvasImageSource) => (source as HTMLCanvasElement).width / width;

  onMount(async () => {
    const theme = themeOf(reference);
    const cards = kinds.map((kind, i) => ({ id: kind, ...placed(i), face: faceOf({ id: kind, kind }, PARITY_SAMPLES[kind], (id) => id) }));
    const scene = await GpuScene.create(reference, Backend.WebGL, theme);
    scene.setCamera({ x: 0, y: 0, zoom: 1 });
    scene.setCards(cards.map((c): Card => ({ ...c, rotation: 0, hidden: false, snapshot: null, running: false, chrome: null })));
    const book = await loadFonts(EMPTY_DOC, {});
    const glyphs = glyphsOf(book, theme.font, WEIGHT);
    const bold = glyphsOf(book, theme.font, BOLD);
    const coreTheme = { ...theme, panel: theme.paper };
    const items = cards.flatMap((c: CoreCard) => cardItems(c, coreTheme, glyphs, bold));
    const raster = await BACKENDS[backend](core, width, height);
    raster.draw({ width, height, background: rgbaOf(theme.canvas), items, unsupported: [] });
    (scene as unknown as { draw: () => void }).draw();
    scores = cards.map((c) => ({ kind: c.id, score: ssim(crop(scene.canvas, c), crop(core, c)) }));
    document.body.dataset.parity = JSON.stringify(scores);
  });
</script>

<div class="row">
  <div class="host" bind:this={reference} style:width="{width}px" style:height="{height}px"></div>
  <canvas bind:this={core} style:width="{width}px" style:height="{height}px"></canvas>
</div>
<table data-testid="parity">
  {#each scores as s (s.kind)}
    <tr><td>{s.kind}</td><td>{s.score.toFixed(3)}</td></tr>
  {/each}
</table>

<style>
  .row {
    display: flex;
    gap: 16px;
  }
  .host {
    position: relative;
  }
</style>
