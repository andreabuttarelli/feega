<script lang="ts">
  import { drawFrame, prepare, type DisplayList, type Prepared } from '$lib/motion/gpu-full/display-list';
  import { smoothingOf } from '$lib/motion/gpu-full/text/painter';
  import { loadFonts } from '$lib/motion/gpu-full/text/load';
  import { createCore, createCoreGl, type CoreRaster } from '$lib/motion/gpu-full/core-web';
  import { createMedia, Readiness, VideoPreload } from '$lib/motion/gpu-full/media';
  import { SpatialIndex } from '$lib/canvas/core/spatial-index';
  import { Outcome } from '$lib/motion/gpu-full/core-outcome';
  import { dotBackground, type Viewport } from '$lib/canvas/dot-grid';
  import { ItemKind } from '$lib/motion/gpu-full/display-list';
  import { FramePacer } from '$lib/canvas/core/frame-pacer';
  import { PART_ITEMS, parts } from '$lib/canvas/core/group-parts';
  import { cached, pictureBytes, resident, heldWhileEdited, type HeldFrame } from '$lib/canvas/core/residency';
  import { BUDGET, currentDevice } from '$lib/canvas/gpu/memory-budget';
  import { AHEAD_REACH, worldUses, type Turn } from '$lib/canvas/core/screen-uses';
  import { SentOverlay, SentUses } from '$lib/canvas/core/use-diff';
  import type { PathItem } from '$lib/motion/gpu-full/display-list';
  import { drawsWhole, onStage, stillFrame, type FrameAt } from '$lib/canvas/core/frame-source';
  import type { FrameOnCanvas } from '$lib/canvas/core/canvas-scene';
  import { postersFor } from '$lib/canvas/core/frame-poster';
  import { readPool } from '$lib/canvas/core/read-pool';
  import { frameBuilder, type FrameDoc } from '$lib/canvas/core/frame-build';
  import { gestureWatch, whenQuiet } from '$lib/canvas/core/gesture-quiet';
  import { readClips, type CustomFrame } from '$lib/motion/gpu-full/dom/custom';
  import type { Pictures } from '$lib/motion/gpu-full/raster';
  import { Stand, fillOrder, firstDrawn, placeholder, standIn, withoutPictures, type Look } from '$lib/canvas/core/placeholders';
  import { Device } from '$lib/canvas/gpu/memory-budget';
  import { describe, factsOf, signatureOf, undrawn, type NodeFacts } from '$lib/canvas/core/core-debug';

  type CoreCard = { key: string; frame: FrameOnCanvas; turn?: Turn };


  let { frames, edited = new Set(), order = [], cards = [], posters = [], overlay = [], look = { paper: '#ffffff', line: '#e5e5e5' }, view, area, sourceUrl, onready, onfallback }: { frames: FrameAt[]; edited?: ReadonlySet<string>; order?: readonly string[]; cards?: CoreCard[]; posters?: CoreCard[]; overlay?: PathItem[]; look?: Look; view: Viewport; area: { width: number; height: number }; sourceUrl: (id: string) => string; onready: (ids: Set<string>) => void; onfallback: (why: string) => void } = $props();

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

  async function readDom(f: FrameAt, source: FrameDoc, prepared: Prepared, frame: number): Promise<CustomFrame | null> {
    const host = readsHost;
    if (!host || !readClips(source.doc).read.length) {
      return null;
    }
    const [{ mountCustomReads }, { composeHtml, Target }, { Liveness }] = await Promise.all([import('$lib/motion/gpu-full/dom/custom'), import('$lib/motion/hyperframes/compose'), import('$lib/motion/interactive/settings')]);
    await whenQuiet(() => gesture.active() || edited.size > 0);
    return domRead(fromView(f), async (signal) => {
      const mounting = mountCustomReads(host, (only) => composeHtml({ doc: source.doc, tokens: source.tokens, assets: source.assets, liveness: Liveness.Baked, target: Target.Screen, only }), prepared);
      signal.addEventListener('abort', () => void mounting.then((r) => r.dispose(), () => undefined));
      return (await mounting).readAt(frame);
    });
  }

  const smoothing = smoothingOf(navigator.userAgent);
  const buildAway = frameBuilder(() => (typeof Worker === 'function' ? new Worker(new URL('../../../canvas/core/frame-build.worker.ts', import.meta.url), { type: 'module' }) : null));

  async function buildHere(f: FrameAt, url: string): Promise<{ list: DisplayList; custom: CustomFrame | null } | null> {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const source = (await res.json()) as FrameDoc;
    const fonts = await loadFonts(source.doc, source.assets, source.tokens);
    const prepared = prepare(source.doc, source.tokens, source.assets, { fonts, smoothing });
    const still = stillFrame(source.doc);
    const custom = await readDom(f, source, prepared, still).catch((e: unknown) => (console.warn('[canvas] core DOM read failed', f.id, e), null));
    return { list: drawFrame(prepared, still, custom?.reads), custom };
  }

  async function load(f: FrameAt) {
    const url = new URL(`${sourceUrl(f.id)}?revision=${f.revision}`, location.href).href;
    const away = await buildAway(url, smoothing).catch(() => null);
    const built = away ? { list: away, custom: null } : await buildHere(f, url);
    if (!built || (await media.ready(built.list)) === Readiness.Partial) {
      return;
    }
    if (built.custom) {
      customPictures.set(keyOf(f), built.custom.picture);
    }
    lists = new Map(lists).set(keyOf(f), onStage(built.list, f.kind));
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

  const rank = $derived(new Map(order.map((id, i) => [id, i])));
  const stacking = (id: string) => rank.get(id) ?? 0;
  const standIns = $derived<{ id: string; box: FrameAt['box']; stand: Stand; turn?: Turn }[]>([...frames.map((f) => ({ id: f.id, box: f.box, stand: Stand.Frame })), ...cards.map((c) => ({ id: c.frame.id, box: c.frame.box, stand: Stand.Card, turn: c.turn }))].sort((a, b) => stacking(a.id) - stacking(b.id)));
  const placeholders = $derived(new Map(standIns.map((n) => [n.id, { ...n, ...placeholder(n.stand, { width: n.box.w, height: n.box.h }, look) }])));
  const BLOCKS = ':blocks';
  const blocksGroup = (key: string) => `${key}${BLOCKS}`;
  const cardBlocks = $derived(new Map(shownCards.filter((c) => !cardLists.has(c.key)).map((c) => [blocksGroup(c.key), { card: c, list: withoutPictures(c.frame.list, look) }])));
  const blocksById = $derived(new Map([...cardBlocks.entries()].map(([group, { card }]) => [card.frame.id, { id: card.frame.id, group, box: card.frame.box, size: { width: card.frame.list.width, height: card.frame.list.height }, bytes: 0, ...(card.turn ? { turn: card.turn } : {}) }])));

  const rebuilding = $derived(new Set([...shownCards.filter((c) => !cardLists.has(c.key)).map((c) => c.frame.id), ...frames.filter((f) => !lists.has(keyOf(f))).map((f) => f.id)]));
  const drawnLast = new Map<string, HeldFrame>();
  const RETAIN_MS: Record<Device, number> = { [Device.Desktop]: 15_000, [Device.Phone]: 0 };
  const lastSeen = new Map<string, number>();
  const placeIndex = $derived(new SpatialIndex([...placeholders.values()].map((p) => ({ id: p.id, ...p.box }))));
  const retained = (now: number) => {
    for (const id of placeIndex.visible(view, area)) {
      lastSeen.set(id, now);
    }
    const keep = new Set<string>();
    for (const [id, at] of lastSeen) {
      if (!placeholders.has(id)) {
        lastSeen.delete(id);
      } else if (now - at < RETAIN_MS[currentDevice()]) {
        keep.add(id);
      }
    }
    return keep;
  };
  const chains = $derived.by(() => {
    const ready = new Map(real.map((f) => [f.id, f]));
    const holding = new Set([...rebuilding, ...retained(Date.now())]);
    for (const id of [...drawnLast.keys()].filter((id) => !holding.has(id))) {
      drawnLast.delete(id);
    }
    return [...placeholders.values()].map((p) => {
      const before = holding.has(p.id) ? drawnLast.get(p.id) : undefined;
      const turned = p.turn ? { turn: p.turn } : {};
      const layers = [ready.get(p.id), before && before.group !== ready.get(p.id)?.group && { ...before, box: p.box, ...turned }, blocksById.get(p.id), { id: p.id, group: p.group, box: p.box, size: { width: p.box.w, height: p.box.h }, bytes: 0, ...turned }];
      return layers.filter((l): l is HeldFrame => l != null);
    });
  });
  const held = $derived(chains.map((c) => c[0]));
  const standIndex = $derived(new SpatialIndex(chains.map((c) => ({ id: c[0].id, ...c[0].box }))));
  const nearTails = () => {
    const near = standIndex.visible(view, area);
    return chains.filter((c) => near.has(c[0].id)).map((c) => c[c.length - 1]);
  };
  const listOf = (group: string) => cardLists.get(group) ?? lists.get(group) ?? cardBlocks.get(group)?.list ?? [...placeholders.values()].find((p) => p.group === group)!.list;

  const waiting = $derived.by(() => {
    const ready = new Set(real.map((f) => f.id));
    return fillOrder([...placeholders.values()], view, area).filter((p) => !ready.has(p.id) && !(p.stand === Stand.Frame && settledFrames.has(p.id) && !posterIds.has(p.id))).length;
  });

  $effect(() => {
    onready(new Set(chains.filter((c) => !c[0].group.endsWith(BLOCKS) && c[0].group !== c[c.length - 1].group).map((c) => c[0].id)));
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
        sent = new SentUses();
        sentOverlay = new SentOverlay();
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
  let sent = new SentUses();
  let sentOverlay = new SentOverlay();
  const painted: Record<Outcome, number> = { [Outcome.Idle]: 0, [Outcome.Reused]: 0, [Outcome.Partial]: 0, [Outcome.Full]: 0 };
  let paintedLabel = $state('');

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

  const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('coreDebug');
  const MAX_LISTED = 12;
  const OVERSCAN_SHARE = 8;
  const OVERSCAN_MAX = 128;
  let debugSignature = '';
  let debugMoving = false;
  let debugFacts: NodeFacts[] = [];
  let hud = $state('');
  let pointer = { x: 0, y: 0 };

  const onScreen = (b: { x: number; y: number; w: number; h: number }) => b.x * view.zoom + view.x < area.width && (b.x + b.w) * view.zoom + view.x > 0 && b.y * view.zoom + view.y < area.height && (b.y + b.h) * view.zoom + view.y > 0;

  function debugFrame(outcome: string, skipped: string[], shown: HeldFrame[]) {
    const drawn = new Map(shown.map((f) => [f.id, f]));
    const readyIds = new Map(real.map((f) => [f.id, f]));
    debugFacts = chains.map((c) => {
      const id = c[0].id;
      const box = placeholders.get(id)!.box;
      return factsOf(id, { onScreen: onScreen(box), drawn: drawn.get(id) ?? null, ready: readyIds.has(id), candidates: { ready: readyIds.get(id) ?? null, previous: drawnLast.get(id) ?? null, blocks: blocksById.get(id) ?? null, placeholder: c[c.length - 1] } });
    });
    const moving = gesture.active();
    const overscan = Math.min(Math.floor((Math.min(area.width, area.height) * resolution) / OVERSCAN_SHARE), OVERSCAN_MAX);
    const refine = `${Math.round(area.width * resolution) + 2 * overscan}x${Math.round(area.height * resolution) + 2 * overscan}`;
    const header = `zoom=${view.zoom.toFixed(3)} view=${Math.round(view.x)},${Math.round(view.y)} area=${Math.round(area.width)}x${Math.round(area.height)} retained=${refine} outcome=${outcome} cacheBytes=${cacheBytes} held=${held.length} pictured=${pictured.size} put=${put.size}`;
    const signature = signatureOf(debugFacts);
    if (debugMoving && !moving) {
      console.info(`[core] gesture end ${header}`);
      undrawn(debugFacts).slice(0, MAX_LISTED).forEach((f) => console.warn(`[core]   ${describe(f)}`));
    }
    if (signature !== debugSignature) {
      debugSignature = signature;
      console.warn(`[core] ${signature ? 'undrawn on screen' : 'all drawn again'} ${header}`);
      undrawn(debugFacts).slice(0, MAX_LISTED).forEach((f) => console.warn(`[core]   ${describe(f)}`));
    }
    if (skipped.length) {
      console.warn(`[core] skipped ${skipped.slice(0, 6).join(' | ')}`);
    }
    debugMoving = moving;
    hud = hudText(header);
  }

  function hudText(header: string): string {
    const world = { x: (pointer.x - view.x) / view.zoom, y: (pointer.y - view.y) / view.zoom };
    const under = [...placeholders.values()].reverse().find((p) => world.x >= p.box.x && world.x <= p.box.x + p.box.w && world.y >= p.box.y && world.y <= p.box.y + p.box.h);
    const facts = under ? debugFacts.find((f) => f.id === under.id) : null;
    return `${header}\n${facts ? describe(facts) : 'no node under cursor'}`;
  }

  $effect(() => {
    if (!DEBUG) {
      return;
    }
    const fail = (e: ErrorEvent | PromiseRejectionEvent) => console.error('[core] error', 'message' in e ? e.message : e.reason);
    const move = (e: PointerEvent) => (pointer = { x: e.clientX, y: e.clientY });
    window.addEventListener('error', fail);
    window.addEventListener('unhandledrejection', fail);
    window.addEventListener('pointermove', move);
    void (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<{ limits: Record<string, number> } | null> } }).gpu?.requestAdapter().then((a) => a && console.info('[core] adapter maxTextureDimension2D', a.limits.maxTextureDimension2D, 'maxBufferSize', a.limits.maxBufferSize));
    return () => {
      window.removeEventListener('error', fail);
      window.removeEventListener('unhandledrejection', fail);
      window.removeEventListener('pointermove', move);
    };
  });

  function paint(): boolean {
    const into = raster;
    if (!into) {
      return false;
    }
    const tails = nearTails();
    const keep = new Set([...whole, ...chains.flat(), ...tails].map((f) => f.group));
    for (const group of [...put, ...putting.keys()].filter((g) => !keep.has(g))) {
      into.dropGroup(group);
      put.delete(group);
      putting.delete(group);
      pictured.delete(group);
    }
    for (const f of tails) {
      while (!put.has(f.group)) {
        putPart(into, f.group);
      }
    }
    let room = gesture.active() ? 0 : ITEMS_PER_FRAME;
    for (const f of held) {
      while (room > 0 && !put.has(f.group)) {
        room -= putPart(into, f.group);
      }
    }
    for (const f of [...tails, ...held].filter((f) => put.has(f.group) && !pictured.has(f.group)).slice(0, PICTURES_PER_FRAME)) {
      if (into.upload(listOf(f.group), pictures, 1)) {
        pictured.add(f.group);
      }
    }
    const shown = chains.flatMap((c) => {
      const layer = firstDrawn(c, pictured);
      return layer ? [layer] : [];
    });
    for (const layer of shown) {
      if (!layer.group.startsWith('placeholder') && !layer.group.endsWith(BLOCKS)) {
        drawnLast.set(layer.id, layer);
      }
    }
    const at: Viewport = { x: view.x * resolution, y: view.y * resolution, zoom: view.zoom * resolution };
    const device = { width: area.width * resolution, height: area.height * resolution };
    const wide = widened(at, device);
    const patch = sent.patch(worldUses(heldWhileEdited(cached(shown, wide.view, wide.area, textureBytes), edited)));
    if (patch) {
      into.patchUses(patch);
    }
    const quiet = !gesture.active();
    if (quiet && sentOverlay.changed(overlay)) {
      into.setOverlay(overlay);
    }
    into.setCamera(at.x, at.y, at.zoom);
    const { outcome, pending, skipped } = into.frame(performance.now());
    painted[outcome]++;
    paintedLabel = `${painted[Outcome.Reused]},${painted[Outcome.Partial]},${painted[Outcome.Full]}`;
    cacheBytes = into.cacheBytes();
    if (DEBUG) {
      debugFrame(outcome, skipped, shown);
    }
    return pending || (!quiet && sentOverlay.waiting(overlay)) || held.some((f) => !pictured.has(f.group));
  }

  let ahead = false;
  const gesture = gestureWatch();
  let lastView = '';

  $effect(() => {
    const now = `${view.x},${view.y},${view.zoom}`;
    if (lastView && now !== lastView) {
      gesture.moved();
    }
    lastView = now;
  });

  const idle = (run: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(run) : setTimeout(run, IDLE_MS));

  function putAhead() {
    const into = raster;
    const next = whole.find((f) => !put.has(f.group));
    if (!into || !next) {
      ahead = false;
      return;
    }
    if (!gesture.active()) {
      putPart(into, next.group);
    }
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
    void [raster, held, edited, overlay, view.x, view.y, view.zoom, area.width, area.height];
    pacer.invalidate();
  });

  $effect(() => () => media.dispose());

</script>

{#if DEBUG}
  <pre class="core-hud">{hud}</pre>
{/if}
<div class="core-reads" bind:this={readsHost} aria-hidden="true"></div>
<div class="core-grid" data-testid="core-grid" style={Object.entries(dotBackground(view)).map(([k, v]) => `${k}: ${v}`).join('; ')}></div>
{#key backend}
  <canvas class="core-frames" bind:this={canvas} data-testid="core-canvas" data-held={held.length} data-waiting={waiting} data-frames={framePuts.length} data-cards={cardPuts.length} data-cache-bytes={cacheBytes} data-painted={paintedLabel} data-posters={cardPuts.length - cards.filter((c) => cardLists.has(c.key)).length} data-partial={[...lists.values()].filter((l) => !drawsWhole(l)).length}></canvas>
{/key}

<style>
  .core-reads {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .core-hud {
    position: fixed;
    left: 56px;
    bottom: 12px;
    z-index: 50;
    margin: 0;
    padding: 6px 8px;
    max-width: 70vw;
    font: 11px/1.4 ui-monospace, monospace;
    color: #fff;
    background: rgb(0 0 0 / 0.7);
    pointer-events: none;
    white-space: pre-wrap;
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
