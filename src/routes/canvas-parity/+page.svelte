<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { GpuScene, themeOf, type Card } from '$lib/canvas/gpu/scene';
  import { Backend } from '$lib/canvas/gpu/backend';
  import { faceOf } from '$lib/canvas/gpu/card-face';
  import { idleChrome } from '$lib/canvas/gpu/idle-chrome';
  import { CONNECTOR_STYLE, type ConnectorType } from '$lib/canvas/connectors';
  import { NODE_PORTS } from '$lib/canvas/node-ports';
  import { NODE_KIND_ICON, NODE_KIND_LABEL } from '$lib/canvas/node-label';
  import { NodeChrome } from '$lib/canvas/selection-chrome';
  import { iconBitmap } from '$lib/components/canvas/gpu/icon-bitmap';
  import { iconNodes } from '$lib/components/canvas/gpu/icon-nodes';
  import { BACKENDS, FullBackend } from '$lib/motion/gpu-full/backends';
  import { faceBook, faceRules } from '$lib/motion/gpu-full/text/fonts';
  import { fontkitSource } from '$lib/motion/gpu-full/text/fontkit-face';
  import type { ImageItem, Item } from '$lib/motion/gpu-full/display-list';
  import type { Affine } from '$lib/motion/parent';
  import { cardItems, type CoreCard } from '$lib/canvas/core/cards';
  import { tileChrome } from '$lib/canvas/core/chrome';
  import { iconContours } from '$lib/canvas/core/icon-outline';
  import { glyphsOf } from '$lib/canvas/core/glyphs';
  import { ssim, type Pixels } from '$lib/canvas/core/ssim';
  import { PARITY_SAMPLES } from '$lib/canvas/core/parity-samples';

  const COLUMNS = 6;
  const CARD = { w: 240, h: 160 };
  const CELL = { w: 320, h: 240 };
  const MARGIN = 50;
  const WEIGHT = 400;
  const BOLD = 600;
  const ICON_PX = 12;
  const ICON_STROKE = 1.8;
  const SETTLE_MS = 2500;
  const SAMPLE_INPUTS: ConnectorType[] = ['text', 'images'];
  const APP_FONT = '/fonts/dm-sans-latin.woff2';

  const width = COLUMNS * CELL.w;
  const height = Math.ceil(PARITY_SAMPLES.length / COLUMNS) * CELL.h;
  const backend = (page.url.searchParams.get('backend') as FullBackend) ?? FullBackend.WebGl2;
  const withChrome = page.url.searchParams.get('chrome') !== 'off';

  let reference: HTMLDivElement;
  let core: HTMLCanvasElement;
  let scores = $state<{ name: string; score: number }[]>([]);

  const placed = (i: number) => ({ x: MARGIN + (i % COLUMNS) * CELL.w, y: MARGIN + Math.floor(i / COLUMNS) * CELL.h, ...CARD });
  const scale = (source: CanvasImageSource) => (source as HTMLCanvasElement).width / width;
  const scaled = (m: Affine, k: number): Affine => [m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k];
  const atDensity = (items: Item[], k: number): Item[] => items.map((i) => ({ ...i, matrix: scaled(i.matrix, k) }));
  const settle = () => new Promise((r) => setTimeout(r, SETTLE_MS));

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

  async function pictures(items: Item[]) {
    const srcs = [...new Set(items.filter((i): i is ImageItem => i.kind === 'image').map((i) => i.src))];
    const loaded = await Promise.all(
      srcs.map(async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return [src, { source: img, size: { width: img.naturalWidth, height: img.naturalHeight } }] as const;
      })
    );
    const bySrc = new Map(loaded);
    return (item: ImageItem) => bySrc.get(item.src) ?? null;
  }

  const portsFor = (kind: keyof typeof NODE_PORTS) => {
    const { inputs, output } = NODE_PORTS[kind];
    return { inputs: Array.isArray(inputs) ? [...inputs] : SAMPLE_INPUTS, output: (output && output in CONNECTOR_STYLE ? output : 'images') as ConnectorType };
  };

  onMount(async () => {
    const theme = themeOf(reference);
    const cards = PARITY_SAMPLES.map((s, i) => ({ id: `${i}`, name: s.name, kind: s.kind, ...placed(i), face: faceOf({ id: `${i}`, kind: s.kind }, s.data, (id) => id, s.thumbs ?? []) }));
    const scene = await GpuScene.create(reference, Backend.WebGL, theme);
    const kinds = [...new Set(cards.map((c) => c.kind))];
    const icons = new Map(await Promise.all(kinds.map(async (k) => [k, iconContours(await iconNodes(NODE_KIND_ICON[k]), ICON_PX, ICON_STROKE)] as const)));
    if (withChrome) {
      await Promise.all(kinds.map(async (k) => scene.setIcon(k, await iconBitmap(NODE_KIND_ICON[k] as never))));
    }
    (scene as unknown as { grid: { visible: boolean } }).grid.visible = false;
    scene.setCamera({ x: 0, y: 0, zoom: 1 });
    scene.setCards(
      cards.map((c): Card => {
        const ports = portsFor(c.kind);
        const chrome = withChrome ? idleChrome({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, connectors: ports.inputs, output: ports.output }, NODE_KIND_LABEL[c.kind], c.kind, (p) => CONNECTOR_STYLE[p].color) : null;
        return { id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, face: c.face, rotation: 0, hidden: false, snapshot: null, running: false, chrome };
      })
    );
    const book = await appFonts();
    const dpr = devicePixelRatio;
    const glyphs = glyphsOf(book, theme.font, WEIGHT);
    const bold = glyphsOf(book, theme.font, BOLD);
    const coreTheme = { ...theme, panel: theme.paper };
    const items = cards.flatMap((c) => {
      const ports = portsFor(c.kind);
      const chrome = withChrome
        ? tileChrome({ id: c.id, x: c.x, y: c.y, width: c.w, height: c.h, ring: NodeChrome.None, handles: false, hovered: false, ringColor: theme.accent, inputs: ports.inputs, output: ports.output, label: NODE_KIND_LABEL[c.kind], icon: icons.get(c.kind) ?? null, names: false }, glyphs)
        : [];
      return [...cardItems(c as CoreCard, coreTheme, glyphs, bold), ...chrome];
    });
    const raster = await BACKENDS[backend](core, width * dpr, height * dpr);
    const pics = await pictures(items);
    await settle();
    const pad = withChrome ? { top: 24, side: 12 } : { top: 0, side: 0 };
    const region = (c: { x: number; y: number; w: number; h: number }) => ({ x: c.x - pad.side, y: c.y - pad.top, w: c.w + 2 * pad.side, h: c.h + pad.top });
    (scene as unknown as { draw: () => void }).draw();
    const before = cards.map((c) => crop(scene.canvas, region(c)));
    raster.draw({ width: width * dpr, height: height * dpr, background: null, items: atDensity(items, dpr), unsupported: [] }, pics);
    scores = cards.map((c, i) => ({ name: c.name, score: ssim(before[i], crop(core, region(c))) }));
    document.body.dataset.parity = JSON.stringify(scores);
  });
</script>

<div class="row">
  <div class="host" bind:this={reference} style:width="{width}px" style:height="{height}px"></div>
  <canvas bind:this={core} style:width="{width}px" style:height="{height}px"></canvas>
</div>
<table data-testid="parity">
  <tbody>
    {#each scores as s (s.name)}
      <tr><td>{s.name}</td><td>{s.score.toFixed(3)}</td></tr>
    {/each}
  </tbody>
</table>

<style>
  .row {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .host {
    position: relative;
  }
</style>
