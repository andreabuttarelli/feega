<script lang="ts">
  import type { BrandTokens } from '$lib/motion/brand';
  import type { MotionDoc } from '$lib/motion/doc';
  import { drawFrame, prepare, type DisplayList } from '$lib/motion/gpu-full/display-list';
  import { smoothingOf } from '$lib/motion/gpu-full/text/painter';
  import { loadFonts } from '$lib/motion/gpu-full/text/load';
  import { createCore, createCoreGl, type CoreRaster } from '$lib/motion/gpu-full/core-web';
  import { createMedia, Readiness } from '$lib/motion/gpu-full/media';
  import { dotBackground, type Viewport } from '$lib/canvas/dot-grid';
  import { ItemKind } from '$lib/motion/gpu-full/display-list';
  import { SpatialIndex } from '$lib/canvas/core/spatial-index';
  import { FramePacer } from '$lib/canvas/core/frame-pacer';
  import { resident, type HeldFrame } from '$lib/canvas/core/residency';
  import { BUDGET, currentDevice } from '$lib/canvas/gpu/memory-budget';
  import { screenUses } from '$lib/canvas/core/screen-uses';
  import { drawsWhole, stillFrame, type FrameAt } from '$lib/canvas/core/frame-source';
  import type { FrameOnCanvas } from '$lib/canvas/core/canvas-scene';

  type CoreCard = { key: string; frame: FrameOnCanvas };

  type Source = { revision: number; doc: MotionDoc; assets: Record<string, string>; tokens: BrandTokens };

  let { frames, cards = [], view, area, sourceUrl, onready, onfallback }: { frames: FrameAt[]; cards?: CoreCard[]; view: Viewport; area: { width: number; height: number }; sourceUrl: (id: string) => string; onready: (ids: Set<string>) => void; onfallback: (why: string) => void } = $props();

  const MAX_RESOLUTION = 2;
  const BACKENDS = [createCore, createCoreGl];

  let canvas = $state<HTMLCanvasElement | null>(null);
  let raster = $state<CoreRaster | null>(null);
  let lists = $state(new Map<string, DisplayList>());
  const asked = new Set<string>();
  const put = new Set<string>();
  const media = createMedia();
  const keyOf = (f: FrameAt) => `${f.id}:${f.revision}`;
  const resolution = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, MAX_RESOLUTION);

  async function load(f: FrameAt) {
    const res = await fetch(`${sourceUrl(f.id)}?revision=${f.revision}`);
    if (!res.ok) {
      return;
    }
    const source = (await res.json()) as Source;
    const fonts = await loadFonts(source.doc, source.assets);
    const prepared = prepare(source.doc, source.tokens, source.assets, { fonts, smoothing: smoothingOf(navigator.userAgent) });
    const list = drawFrame(prepared, stillFrame(source.doc));
    if ((await media.ready(list)) === Readiness.Partial) {
      return;
    }
    lists = new Map(lists).set(keyOf(f), list);
  }

  $effect(() => {
    const seen = new SpatialIndex(frames.map((f) => ({ id: f.id, ...f.box }))).visible(view, area);
    for (const f of frames) {
      if (seen.has(f.id) && !asked.has(keyOf(f))) {
        asked.add(keyOf(f));
        void load(f).catch((e: unknown) => console.warn('[canvas] core frame not loaded', f.id, e));
      }
    }
  });

  let cardLists = $state(new Map<string, DisplayList>());
  const readying = new Set<string>();

  $effect(() => {
    for (const c of cards) {
      if (!cardLists.has(c.key) && !readying.has(c.key)) {
        readying.add(c.key);
        void media.ready(c.frame.list).then((readiness) => {
          if (readiness === Readiness.Whole) {
            cardLists = new Map(cardLists).set(c.key, c.frame.list);
          }
        });
      }
    }
  });

  const imagesIn = (list: DisplayList) => list.items.filter((i) => i.kind === ItemKind.Image).length;

  const cardPuts = $derived(cards.flatMap((c): HeldFrame[] => (cardLists.has(c.key) ? [{ id: c.frame.id, group: c.key, box: c.frame.box, size: { width: c.frame.list.width, height: c.frame.list.height }, images: imagesIn(c.frame.list) }] : [])));

  const framePuts = $derived(
    frames.flatMap((f): HeldFrame[] => {
      const list = lists.get(keyOf(f));
      return list && drawsWhole(list) ? [{ id: f.id, group: keyOf(f), box: f.box, size: { width: list.width, height: list.height }, images: imagesIn(list) }] : [];
    })
  );

  const whole = $derived([...cardPuts, ...framePuts]);
  const listOf = (group: string) => cardLists.get(group) ?? lists.get(group)!;
  const textureBytes = BUDGET[currentDevice()].textureBytes;
  const held = $derived(resident(whole, view, area, textureBytes));

  $effect(() => {
    onready(new Set(held.map((f) => f.id)));
  });

  $effect(() => {
    const target = canvas;
    const width = Math.round(area.width * resolution);
    const height = Math.round(area.height * resolution);
    if (!target || !width || !height) {
      return;
    }
    let gone = false;
    let made: CoreRaster | null = null;
    const attempt = (i: number): Promise<void> =>
      BACKENDS[i](target, width, height).then(
        (r) => {
          made = r;
          if (gone) {
            r.dispose();
            return;
          }
          put.clear();
          raster = r;
        },
        (e: unknown) => (i + 1 < BACKENDS.length ? attempt(i + 1) : onfallback(e instanceof Error ? e.message : String(e)))
      );
    void attempt(0);
    return () => {
      gone = true;
      raster = null;
      made?.dispose();
    };
  });

  function paint(): boolean {
    const into = raster;
    if (!into) {
      return false;
    }
    const shown = held;
    const keep = new Set(shown.map((f) => f.group));
    for (const group of [...put].filter((g) => !keep.has(g))) {
      into.dropGroup(group);
      put.delete(group);
    }
    for (const f of shown.filter((f) => !put.has(f.group))) {
      into.putGroup(f.group, listOf(f.group), media.pictures);
      put.add(f.group);
    }
    const at: Viewport = { x: view.x * resolution, y: view.y * resolution, zoom: view.zoom * resolution };
    into.drawScreen(screenUses(shown, at, { width: area.width * resolution, height: area.height * resolution }, null), media.pictures);
    return false;
  }

  const pacer = new FramePacer(paint, (frame) => requestAnimationFrame(frame));

  $effect(() => {
    void [raster, held, view.x, view.y, view.zoom, area.width, area.height];
    pacer.invalidate();
  });

  $effect(() => () => media.dispose());
</script>

<canvas class="core-frames" bind:this={canvas} style={Object.entries(dotBackground(view)).map(([k, v]) => `${k}: ${v}`).join('; ')} data-testid="core-canvas" data-frames={framePuts.length} data-cards={cardPuts.length} data-partial={[...lists.values()].filter((l) => !drawsWhole(l)).length}></canvas>

<style>
  .core-frames {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }
</style>
