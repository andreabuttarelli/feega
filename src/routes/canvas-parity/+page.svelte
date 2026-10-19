<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { GpuScene, themeOf, type Card } from '$lib/canvas/gpu/scene';
  import { Backend } from '$lib/canvas/gpu/backend';
  import { faceOf } from '$lib/canvas/gpu/card-face';
  import { BACKENDS, FullBackend } from '$lib/motion/gpu-full/backends';
  import { faceBook, faceRules } from '$lib/motion/gpu-full/text/fonts';
  import { fontkitSource } from '$lib/motion/gpu-full/text/fontkit-face';
  import type { Item } from '$lib/motion/gpu-full/display-list';
  import type { Affine } from '$lib/motion/parent';
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
  const APP_FONT = '/fonts/dm-sans-latin.woff2';

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

  async function appFonts() {
    const url = new URL(APP_FONT, location.origin).href;
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const css = `@font-face { font-family: 'DM Sans'; font-weight: 100 1000; src: url('${url}'); }`;
    return faceBook(faceRules(css), new Map([[url, fontkitSource(bytes)]]), []);
  }

  const scaled = (m: Affine, k: number): Affine => [m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k];
  const atDensity = (items: Item[], k: number): Item[] => items.map((i) => ({ ...i, matrix: scaled(i.matrix, k) }));

  const scale = (source: CanvasImageSource) => (source as HTMLCanvasElement).width / width;

  onMount(async () => {
    const theme = themeOf(reference);
    const cards = kinds.map((kind, i) => ({ id: kind, ...placed(i), face: faceOf({ id: kind, kind }, PARITY_SAMPLES[kind], (id) => id) }));
    const scene = await GpuScene.create(reference, Backend.WebGL, theme);
    scene.setCamera({ x: 0, y: 0, zoom: 1 });
    scene.setCards(cards.map((c): Card => ({ ...c, rotation: 0, hidden: false, snapshot: null, running: false, chrome: null })));
    const book = await appFonts();
    const dpr = devicePixelRatio;
    const glyphs = glyphsOf(book, theme.font, WEIGHT);
    const bold = glyphsOf(book, theme.font, BOLD);
    const coreTheme = { ...theme, panel: theme.paper };
    const items = cards.flatMap((c: CoreCard) => cardItems(c, coreTheme, glyphs, bold));
    const raster = await BACKENDS[backend](core, width * dpr, height * dpr);
    raster.draw({ width: width * dpr, height: height * dpr, background: rgbaOf(theme.canvas), items: atDensity(items, dpr), unsupported: [] });
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
  <tbody>
  {#each scores as s (s.kind)}
    <tr><td>{s.kind}</td><td>{s.score.toFixed(3)}</td></tr>
  {/each}
  </tbody>
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
