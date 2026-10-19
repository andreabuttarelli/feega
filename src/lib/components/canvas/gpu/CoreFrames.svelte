<script lang="ts">
  import type { BrandTokens } from '$lib/motion/brand';
  import type { MotionDoc } from '$lib/motion/doc';
  import { drawFrame, prepare, type DisplayList, type Prepared } from '$lib/motion/gpu-full/display-list';
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
  import { screenUses, type Turn } from '$lib/canvas/core/screen-uses';
  import { throughCamera } from '$lib/canvas/core/world-overlay';
  import type { PathItem } from '$lib/motion/gpu-full/display-list';
  import { drawsWhole, onStage, stillFrame, type FrameAt } from '$lib/canvas/core/frame-source';
  import type { FrameOnCanvas } from '$lib/canvas/core/canvas-scene';
  import { postersFor } from '$lib/canvas/core/frame-poster';
  import { oneAtATime } from '$lib/canvas/core/one-at-a-time';
  import { readClips, type CustomFrame } from '$lib/motion/gpu-full/dom/custom';
  import type { Pictures } from '$lib/motion/gpu-full/raster';

  type CoreCard = { key: string; frame: FrameOnCanvas; turn?: Turn };

  type Source = { revision: number; doc: MotionDoc; assets: Record<string, string>; tokens: BrandTokens };

  let { frames, cards = [], posters = [], overlay = [], view, area, sourceUrl, onready, onfallback }: { frames: FrameAt[]; cards?: CoreCard[]; posters?: CoreCard[]; overlay?: PathItem[]; view: Viewport; area: { width: number; height: number }; sourceUrl: (id: string) => string; onready: (ids: Set<string>) => void; onfallback: (why: string) => void } = $props();

  const MAX_RESOLUTION = 2;
  const BACKENDS = [createCore, createCoreGl];

  let canvas = $state<HTMLCanvasElement | null>(null);
  let backend = $state(0);
  let raster = $state<CoreRaster | null>(null);
  let lists = $state(new Map<string, DisplayList>());
  const asked = new Set<string>();
  const put = new Set<string>();
  const media = createMedia();
  const keyOf = (f: FrameAt) => `${f.id}:${f.revision}`;
  const imagesIn = (list: DisplayList) => list.items.filter((i) => i.kind === ItemKind.Image).length;
  const resolution = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, MAX_RESOLUTION);

  let readsHost = $state<HTMLDivElement | null>(null);
  const domRead = oneAtATime();
  const customPictures = new Map<string, CustomFrame['picture']>();
  const pictures: Pictures = (item) => [...customPictures.values()].reduce<ReturnType<Pictures>>((found, of) => found ?? of(item), null) ?? media.pictures(item);

  async function readDom(source: Source, prepared: Prepared, frame: number): Promise<CustomFrame | null> {
    const host = readsHost;
    if (!host || !readClips(source.doc).read.length) {
      return null;
    }
    const [{ mountCustomReads }, { composeHtml, Target }, { Liveness }] = await Promise.all([import('$lib/motion/gpu-full/dom/custom'), import('$lib/motion/hyperframes/compose'), import('$lib/motion/interactive/settings')]);
    return domRead(async () => {
      const reads = await mountCustomReads(host, (only) => composeHtml({ doc: source.doc, tokens: source.tokens, assets: source.assets, liveness: Liveness.Baked, target: Target.Screen, only }), prepared);
      try {
        return await reads.readAt(frame);
      } finally {
        reads.dispose();
      }
    });
  }

  async function load(f: FrameAt) {
    const res = await fetch(`${sourceUrl(f.id)}?revision=${f.revision}`);
    if (!res.ok) {
      return;
    }
    const source = (await res.json()) as Source;
    const fonts = await loadFonts(source.doc, source.assets, source.tokens);
    const prepared = prepare(source.doc, source.tokens, source.assets, { fonts, smoothing: smoothingOf(navigator.userAgent) });
    const still = stillFrame(source.doc);
    const custom = await readDom(source, prepared, still).catch((e: unknown) => (console.warn('[canvas] core DOM read failed', f.id, e), null));
    const list = drawFrame(prepared, still, custom?.reads);
    if ((await media.ready(list)) === Readiness.Partial) {
      return;
    }
    if (custom) {
      customPictures.set(keyOf(f), custom.picture);
    }
    lists = new Map(lists).set(keyOf(f), onStage(list, f.kind));
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

  const framePuts = $derived(
    frames.flatMap((f): HeldFrame[] => {
      const list = lists.get(keyOf(f));
      return list && drawsWhole(list) ? [{ id: f.id, group: keyOf(f), box: f.box, size: { width: list.width, height: list.height }, images: imagesIn(list) }] : [];
    })
  );
  const shownCards = $derived([...cards, ...postersFor(posters, new Set(framePuts.map((f) => f.id)))]);

  $effect(() => {
    for (const c of shownCards) {
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

  const cardPuts = $derived(shownCards.flatMap((c): HeldFrame[] => (cardLists.has(c.key) ? [{ id: c.frame.id, group: c.key, box: c.frame.box, size: { width: c.frame.list.width, height: c.frame.list.height }, images: imagesIn(c.frame.list), turn: c.turn }] : [])));

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
    const tried = backend;
    void BACKENDS[tried](target, width, height).then(
      (r) => {
        made = r;
        if (gone) {
          r.dispose();
          return;
        }
        put.clear();
        raster = r;
      },
      (e: unknown) => {
        if (gone) {
          return;
        }
        if (tried + 1 < BACKENDS.length) {
          backend = tried + 1;
          return;
        }
        onfallback(e instanceof Error ? e.message : String(e));
      }
    );
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
      into.putGroup(f.group, listOf(f.group), pictures);
      put.add(f.group);
    }
    const at: Viewport = { x: view.x * resolution, y: view.y * resolution, zoom: view.zoom * resolution };
    const screen = screenUses(shown, at, { width: area.width * resolution, height: area.height * resolution }, null);
    into.drawScreen({ ...screen, items: [...screen.items, ...throughCamera(overlay, at)] }, pictures);
    return false;
  }

  const pacer = new FramePacer(paint, (frame) => requestAnimationFrame(frame));

  $effect(() => {
    void [raster, held, overlay, view.x, view.y, view.zoom, area.width, area.height];
    pacer.invalidate();
  });

  $effect(() => () => media.dispose());
</script>

<div class="core-reads" bind:this={readsHost} aria-hidden="true"></div>
<div class="core-grid" data-testid="core-grid" style={Object.entries(dotBackground(view)).map(([k, v]) => `${k}: ${v}`).join('; ')}></div>
{#key backend}
  <canvas class="core-frames" bind:this={canvas} data-testid="core-canvas" data-frames={framePuts.length} data-cards={cardPuts.length} data-posters={cardPuts.length - cards.filter((c) => cardLists.has(c.key)).length} data-partial={[...lists.values()].filter((l) => !drawsWhole(l)).length}></canvas>
{/key}

<style>
  .core-reads {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .core-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .core-frames {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }
</style>
