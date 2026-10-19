<script lang="ts">
  import type { BrandTokens } from '$lib/motion/brand';
  import type { MotionDoc } from '$lib/motion/doc';
  import { drawFrame, prepare, type DisplayList, type Prepared } from '$lib/motion/gpu-full/display-list';
  import { smoothingOf } from '$lib/motion/gpu-full/text/painter';
  import { loadFonts } from '$lib/motion/gpu-full/text/load';
  import { createCore, createCoreGl, type CoreRaster } from '$lib/motion/gpu-full/core-web';
  import { createMedia, Readiness, VideoPreload } from '$lib/motion/gpu-full/media';
  import { SpatialIndex } from '$lib/canvas/core/spatial-index';
  import { dotBackground, type Viewport } from '$lib/canvas/dot-grid';
  import { ItemKind } from '$lib/motion/gpu-full/display-list';
  import { FramePacer } from '$lib/canvas/core/frame-pacer';
  import { PART_ITEMS, parts } from '$lib/canvas/core/group-parts';
  import { cached, pictureBytes, resident, type HeldFrame } from '$lib/canvas/core/residency';
  import { BUDGET, currentDevice } from '$lib/canvas/gpu/memory-budget';
  import { AHEAD_REACH, screenUses, type Turn } from '$lib/canvas/core/screen-uses';
  import { throughCamera } from '$lib/canvas/core/world-overlay';
  import type { PathItem } from '$lib/motion/gpu-full/display-list';
  import { drawsWhole, onStage, stillFrame, type FrameAt } from '$lib/canvas/core/frame-source';
  import type { FrameOnCanvas } from '$lib/canvas/core/canvas-scene';
  import { postersFor } from '$lib/canvas/core/frame-poster';
  import { readPool } from '$lib/canvas/core/read-pool';
  import { readClips, type CustomFrame } from '$lib/motion/gpu-full/dom/custom';
  import type { Pictures } from '$lib/motion/gpu-full/raster';
  import { Stand, fillOrder, placeholder, standIn, withoutPictures, type Look } from '$lib/canvas/core/placeholders';
  import { Device } from '$lib/canvas/gpu/memory-budget';

  type CoreCard = { key: string; frame: FrameOnCanvas; turn?: Turn };

  type Source = { revision: number; doc: MotionDoc; assets: Record<string, string>; tokens: BrandTokens };

  let { frames, cards = [], posters = [], overlay = [], look = { paper: '#ffffff', line: '#e5e5e5' }, view, area, sourceUrl, onready, onfallback }: { frames: FrameAt[]; cards?: CoreCard[]; posters?: CoreCard[]; overlay?: PathItem[]; look?: Look; view: Viewport; area: { width: number; height: number }; sourceUrl: (id: string) => string; onready: (ids: Set<string>) => void; onfallback: (why: string) => void } = $props();

  const MAX_RESOLUTION = 2;
  const IN_FLIGHT: Record<Device, number> = { [Device.Desktop]: 6, [Device.Phone]: 3 };
  const BACKENDS = [createCore, createCoreGl];

  let canvas = $state<HTMLCanvasElement | null>(null);
  let backend = $state(0);
  let raster = $state<CoreRaster | null>(null);
  let lists = $state(new Map<string, DisplayList>());
  const asked = new Set<string>();
  const put = new Set<string>();
  const pictured = new Set<string>();
  const putting = new Map<string, { parts: DisplayList[]; next: number }>();
  const media = createMedia({ videoPreload: VideoPreload.Metadata });
  const widened = (v: Viewport, a: { width: number; height: number }) => ({ view: { x: v.x + a.width * AHEAD_REACH, y: v.y + a.height * AHEAD_REACH, zoom: v.zoom }, area: { width: a.width * (1 + 2 * AHEAD_REACH), height: a.height * (1 + 2 * AHEAD_REACH) } });
  const keyOf = (f: FrameAt) => `${f.id}:${f.revision}`;
  const resolution = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, MAX_RESOLUTION);

  let readsHost = $state<HTMLDivElement | null>(null);
  const READ_LANES = 2;
  const READ_TIMEOUT_MS = 8000;
  const domRead = readPool({ lanes: READ_LANES, timeoutMs: READ_TIMEOUT_MS });
  const fromView = (f: FrameAt) => () => Math.hypot(view.x + (f.box.x + f.box.w / 2) * view.zoom - area.width / 2, view.y + (f.box.y + f.box.h / 2) * view.zoom - area.height / 2);
  const customPictures = new Map<string, CustomFrame['picture']>();
  const pictures: Pictures = (item) => [...customPictures.values()].reduce<ReturnType<Pictures>>((found, of) => found ?? of(item), null) ?? media.pictures(item);

  async function readDom(f: FrameAt, source: Source, prepared: Prepared, frame: number): Promise<CustomFrame | null> {
    const host = readsHost;
    if (!host || !readClips(source.doc).read.length) {
      return null;
    }
    const [{ mountCustomReads }, { composeHtml, Target }, { Liveness }] = await Promise.all([import('$lib/motion/gpu-full/dom/custom'), import('$lib/motion/hyperframes/compose'), import('$lib/motion/interactive/settings')]);
    return domRead(fromView(f), async (signal) => {
      const mounting = mountCustomReads(host, (only) => composeHtml({ doc: source.doc, tokens: source.tokens, assets: source.assets, liveness: Liveness.Baked, target: Target.Screen, only }), prepared);
      signal.addEventListener('abort', () => void mounting.then((r) => r.dispose(), () => undefined));
      return (await mounting).readAt(frame);
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
    const custom = await readDom(f, source, prepared, still).catch((e: unknown) => (console.warn('[canvas] core DOM read failed', f.id, e), null));
    const list = drawFrame(prepared, still, custom?.reads);
    if ((await media.ready(list)) === Readiness.Partial) {
      return;
    }
    if (custom) {
      customPictures.set(keyOf(f), custom.picture);
    }
    lists = new Map(lists).set(keyOf(f), onStage(list, f.kind));
  }

  let inFlight = $state(0);
  let settledFrames = $state(new Set<string>());

  $effect(() => {
    const room = IN_FLIGHT[currentDevice()] - inFlight;
    if (room <= 0) {
      return;
    }
    const next = fillOrder(frames, view, area).filter((f) => !asked.has(keyOf(f))).slice(0, room);
    for (const f of next) {
      asked.add(keyOf(f));
      inFlight++;
      void load(f)
        .catch((e: unknown) => console.warn('[canvas] core frame not loaded', f.id, e))
        .finally(() => {
          inFlight--;
          settledFrames = new Set(settledFrames).add(f.id);
        });
    }
  });

  let cardLists = $state(new Map<string, DisplayList>());
  const readying = new Set<string>();

  const framePuts = $derived(
    frames.flatMap((f): HeldFrame[] => {
      const list = lists.get(keyOf(f));
      return list && drawsWhole(list) ? [{ id: f.id, group: keyOf(f), box: f.box, size: { width: list.width, height: list.height }, bytes: pictureBytes(list.items) }] : [];
    })
  );
  const posterIds = $derived(new Set(posters.map((p) => p.frame.id)));
  const shownCards = $derived([...cards, ...postersFor(posters, new Set(framePuts.map((f) => f.id)))]);

  const cardIndex = $derived(new SpatialIndex(shownCards.map((c) => ({ id: c.key, ...c.frame.box }))));

  $effect(() => {
    const onScreen = cardIndex.visible(view, area);
    for (const c of shownCards) {
      if (onScreen.has(c.key) && !cardLists.has(c.key) && !readying.has(c.key)) {
        readying.add(c.key);
        void media.ready(c.frame.list).then(() => (cardLists = new Map(cardLists).set(c.key, withoutPictures(c.frame.list, look, (i) => !pictures(i)))));
      }
    }
  });

  const cardPuts = $derived(shownCards.flatMap((c): HeldFrame[] => (cardLists.has(c.key) ? [{ id: c.frame.id, group: c.key, box: c.frame.box, size: { width: c.frame.list.width, height: c.frame.list.height }, bytes: pictureBytes(c.frame.list.items), turn: c.turn }] : [])));

  const whole = $derived([...cardPuts, ...framePuts]);
  const textureBytes = BUDGET[currentDevice()].textureBytes;
  const real = $derived(resident(whole, view, area, textureBytes));

  const standIns = $derived<{ id: string; box: FrameAt['box']; stand: Stand; turn?: Turn }[]>([...frames.map((f) => ({ id: f.id, box: f.box, stand: Stand.Frame })), ...cards.map((c) => ({ id: c.frame.id, box: c.frame.box, stand: Stand.Card, turn: c.turn }))]);
  const placeholders = $derived(new Map(standIns.map((n) => [n.id, { ...n, ...placeholder(n.stand, { width: n.box.w, height: n.box.h }, look) }])));
  const blocksGroup = (key: string) => `${key}:blocks`;
  const cardBlocks = $derived(new Map(shownCards.filter((c) => !cardLists.has(c.key)).map((c) => [blocksGroup(c.key), { card: c, list: withoutPictures(c.frame.list, look) }])));
  const blocksById = $derived(new Map([...cardBlocks.entries()].map(([group, { card }]) => [card.frame.id, { id: card.frame.id, group, box: card.frame.box, size: { width: card.frame.list.width, height: card.frame.list.height }, bytes: 0, ...(card.turn ? { turn: card.turn } : {}) }])));

  const held = $derived.by(() => {
    const ready = new Map(real.map((f) => [f.id, f]));
    return [...placeholders.values()].flatMap((p) => {
      const shown = standIn<HeldFrame>([ready.get(p.id), blocksById.get(p.id), { id: p.id, group: p.group, box: p.box, size: { width: p.box.w, height: p.box.h }, bytes: 0, ...(p.turn ? { turn: p.turn } : {}) }]);
      return shown ? [shown] : [];
    });
  });
  const listOf = (group: string) => cardLists.get(group) ?? lists.get(group) ?? cardBlocks.get(group)?.list ?? [...placeholders.values()].find((p) => p.group === group)!.list;

  const waiting = $derived.by(() => {
    const ready = new Set(real.map((f) => f.id));
    return fillOrder([...placeholders.values()], view, area).filter((p) => !ready.has(p.id) && !(p.stand === Stand.Frame && settledFrames.has(p.id) && !posterIds.has(p.id))).length;
  });

  $effect(() => {
    onready(new Set(real.map((f) => f.id)));
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
        pictured.clear();
        putting.clear();
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

  let cacheBytes = $state(0);
  const IDLE_MS = 50;
  const PICTURES_PER_FRAME = 4;
  const ITEMS_PER_FRAME = 2 * PART_ITEMS;

  function putPart(into: CoreRaster, group: string): number {
    const job = putting.get(group) ?? { parts: parts(listOf(group), PART_ITEMS), next: 0 };
    const part = job.parts[job.next];
    if (job.next === 0) {
      into.putGroup(group, part);
    } else {
      into.appendGroup(group, part);
    }
    job.next++;
    if (job.next < job.parts.length) {
      putting.set(group, job);
      return part.items.length + 1;
    }
    putting.delete(group);
    put.add(group);
    return part.items.length + 1;
  }

  function paint(): boolean {
    const into = raster;
    if (!into) {
      return false;
    }
    const keep = new Set([...whole, ...held].map((f) => f.group));
    for (const group of [...put, ...putting.keys()].filter((g) => !keep.has(g))) {
      into.dropGroup(group);
      put.delete(group);
      putting.delete(group);
      pictured.delete(group);
    }
    let room = ITEMS_PER_FRAME;
    for (const f of held) {
      while (room > 0 && !put.has(f.group)) {
        room -= putPart(into, f.group);
      }
    }
    for (const f of held.filter((f) => put.has(f.group) && !pictured.has(f.group)).slice(0, PICTURES_PER_FRAME)) {
      if (into.upload(listOf(f.group), pictures, 1)) {
        pictured.add(f.group);
      }
    }
    const shown = held.filter((f) => pictured.has(f.group));
    const at: Viewport = { x: view.x * resolution, y: view.y * resolution, zoom: view.zoom * resolution };
    const device = { width: area.width * resolution, height: area.height * resolution };
    const wide = widened(at, device);
    const screen = screenUses(cached(shown, wide.view, wide.area, textureBytes), at, device, null);
    const pending = into.drawScreen({ ...screen, items: [...screen.items, ...throughCamera(overlay, at)] }, pictures);
    cacheBytes = into.cacheBytes();
    return pending || held.some((f) => !pictured.has(f.group));
  }

  let ahead = false;

  const idle = (run: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(run) : setTimeout(run, IDLE_MS));

  function putAhead() {
    const into = raster;
    const next = whole.find((f) => !put.has(f.group));
    if (!into || !next) {
      ahead = false;
      return;
    }
    putPart(into, next.group);
    idle(putAhead);
  }

  $effect(() => {
    void [raster, whole];
    if (!ahead) {
      ahead = true;
      idle(putAhead);
    }
  });

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
  <canvas class="core-frames" bind:this={canvas} data-testid="core-canvas" data-held={held.length} data-waiting={waiting} data-frames={framePuts.length} data-cards={cardPuts.length} data-cache-bytes={cacheBytes} data-posters={cardPuts.length - cards.filter((c) => cardLists.has(c.key)).length} data-partial={[...lists.values()].filter((l) => !drawsWhole(l)).length}></canvas>
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
