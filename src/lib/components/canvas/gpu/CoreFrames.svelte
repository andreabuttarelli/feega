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
  import { screenUses, type Turn } from '$lib/canvas/core/screen-uses';
  import { visibleIds } from '$lib/canvas/gpu/camera';
  import { throughCamera } from '$lib/canvas/core/world-overlay';
  import type { PathItem } from '$lib/motion/gpu-full/display-list';
  import { drawsWhole, onStage, stillFrame, type FrameAt } from '$lib/canvas/core/frame-source';
  import type { FrameOnCanvas } from '$lib/canvas/core/canvas-scene';
  import { blankCard, choose, nearestFirst, withoutPictures } from '$lib/canvas/core/placeholder';
  import type { CoreTheme } from '$lib/canvas/core/overlay';
  import type { Box } from '$lib/canvas/core/canvas-scene';

  type CoreCard = { key: string; frame: FrameOnCanvas; turn?: Turn };

  type Blank = { id: string; box: Box; turn?: Turn };

  type Source = { revision: number; doc: MotionDoc; assets: Record<string, string>; tokens: BrandTokens };

  let { frames, cards = [], posters = [], blanks = [], theme = null, overlay = [], view, area, sourceUrl, onready, onfallback }: { frames: FrameAt[]; cards?: CoreCard[]; posters?: CoreCard[]; blanks?: Blank[]; theme?: CoreTheme | null; overlay?: PathItem[]; view: Viewport; area: { width: number; height: number }; sourceUrl: (id: string) => string; onready: (ids: Set<string>) => void; onfallback: (why: string) => void } = $props();

  const MAX_RESOLUTION = 2;
  const BACKENDS = [createCore, createCoreGl];
  const LOADS_AT_ONCE = 4;
  const PUTS_PER_PAINT = 6;

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

  async function load(f: FrameAt) {
    const res = await fetch(`${sourceUrl(f.id)}?revision=${f.revision}`);
    if (!res.ok) {
      return;
    }
    const source = (await res.json()) as Source;
    const fonts = await loadFonts(source.doc, source.assets, source.tokens);
    const prepared = prepare(source.doc, source.tokens, source.assets, { fonts, smoothing: smoothingOf(navigator.userAgent) });
    const list = drawFrame(prepared, stillFrame(source.doc));
    if ((await media.ready(list)) === Readiness.Partial) {
      return;
    }
    lists = new Map(lists).set(keyOf(f), onStage(list, f.kind));
  }

  let loading = $state(0);

  $effect(() => {
    const seen = new SpatialIndex(frames.map((f) => ({ id: f.id, ...f.box }))).visible(view, area);
    const due = nearestFirst(frames.filter((f) => seen.has(f.id) && !asked.has(keyOf(f))), view, area).slice(0, Math.max(0, LOADS_AT_ONCE - loading));
    for (const f of due) {
      asked.add(keyOf(f));
      loading += 1;
      void load(f)
        .catch((e: unknown) => console.warn('[canvas] core frame not loaded', f.id, e))
        .finally(() => (loading -= 1));
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
  const shownCards = $derived([...cards, ...posters]);

  $effect(() => {
    for (const c of nearestFirst(shownCards.map((c) => ({ ...c, box: c.frame.box })), view, area)) {
      if (!cardLists.has(c.key) && !readying.has(c.key)) {
        readying.add(c.key);
        void media.ready(c.frame.list).then((readiness) => {
          const look = theme;
          if (readiness === Readiness.Whole || look) {
            cardLists = new Map(cardLists).set(c.key, readiness === Readiness.Whole || !look ? c.frame.list : withoutPictures(c.frame.list, look, (i) => !media.pictures(i)));
          }
        });
      }
    }
  });

  const cardPuts = $derived(shownCards.flatMap((c): HeldFrame[] => (cardLists.has(c.key) ? [{ id: c.frame.id, group: c.key, box: c.frame.box, size: { width: c.frame.list.width, height: c.frame.list.height }, images: imagesIn(c.frame.list), turn: c.turn }] : [])));

  const whole = $derived([...cardPuts, ...framePuts]);
  const textureBytes = BUDGET[currentDevice()].textureBytes;
  const held = $derived(resident(whole, view, area, textureBytes));

  $effect(() => {
    onready(new Set(held.map((f) => f.id)));
  });

  const stand = new Map<string, DisplayList>();
  const standIn = (group: string, make: () => DisplayList) => stand.get(group) ?? stand.set(group, make()).get(group)!;
  const bareKey = (key: string) => `${key}#bare`;
  const blankKey = (b: Blank) => `${b.id}#blank:${b.box.w}x${b.box.h}`;
  const sized = (id: string, group: string, box: Box, list: DisplayList, turn?: Turn): HeldFrame => ({ id, group, box, size: { width: list.width, height: list.height }, images: 0, turn });

  const nodes = $derived.by(() => {
    const look = theme;
    const best = new Map<string, HeldFrame[]>();
    const add = (f: HeldFrame) => best.set(f.id, [...(best.get(f.id) ?? []), f]);
    const resting = new Set(held.map((f) => f.group));
    for (const f of [...framePuts, ...cardPuts].filter((f) => resting.has(f.group))) {
      add(f);
    }
    if (look) {
      for (const c of shownCards) {
        add(sized(c.frame.id, bareKey(c.key), c.frame.box, standIn(bareKey(c.key), () => withoutPictures(c.frame.list, look)), c.turn));
      }
      for (const b of blanks) {
        add(sized(b.id, blankKey(b), b.box, standIn(blankKey(b), () => blankCard(b.box, look)), b.turn));
      }
    }
    const used = new Set([...best.values()].flat().map((f) => f.group));
    for (const group of [...stand.keys()].filter((g) => !used.has(g))) {
      stand.delete(group);
    }
    const order = [...blanks.map((b) => b.id), ...best.keys()];
    return [...new Set(order)].map((id) => best.get(id) ?? []);
  });

  const listOf = (group: string) => stand.get(group) ?? cardLists.get(group) ?? lists.get(group)!;

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
    const ranked = nearestFirst(nodes.flatMap((layers) => (layers.length ? [{ box: layers[0].box, layers }] : [])), view, area);
    const picked = new Map(choose(ranked.map((n) => n.layers), put, PUTS_PER_PAINT).map((f) => [f.id, f]));
    const shown = nodes.flatMap((layers) => (layers.length && picked.has(layers[0].id) ? [picked.get(layers[0].id)!] : []));
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
    const screen = screenUses(shown, at, { width: area.width * resolution, height: area.height * resolution }, null);
    into.drawScreen({ ...screen, items: [...screen.items, ...throughCamera(overlay, at)] }, media.pictures);
    const ids = new Set(shown.map((f) => f.id));
    const onView = visibleIds(blanks.map((b) => ({ id: b.id, ...b.box })), view, area);
    canvas?.setAttribute('data-holes', String([...onView].filter((id) => !ids.has(id)).length));
    canvas?.setAttribute('data-standing-in', String(shown.filter((f) => onView.has(f.id) && stand.has(f.group)).length));
    return nodes.some((layers) => layers.length > 0 && !put.has(layers[0].group));
  }

  const pacer = new FramePacer(paint, (frame) => requestAnimationFrame(frame));

  $effect(() => {
    void [raster, nodes, overlay, view.x, view.y, view.zoom, area.width, area.height];
    pacer.invalidate();
  });

  $effect(() => () => media.dispose());
</script>

<div class="core-grid" data-testid="core-grid" style={Object.entries(dotBackground(view)).map(([k, v]) => `${k}: ${v}`).join('; ')}></div>
{#key backend}
  <canvas class="core-frames" bind:this={canvas} data-testid="core-canvas" data-frames={framePuts.length} data-cards={cardPuts.length} data-posters={cardPuts.length - cards.filter((c) => cardLists.has(c.key)).length} data-partial={[...lists.values()].filter((l) => !drawsWhole(l)).length}></canvas>
{/key}

<style>
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
