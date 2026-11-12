<script lang="ts">
  import { untrack } from 'svelte';
  import { addTally, countFrame } from '$lib/canvas/gpu/frame-stats';
  import { sharedFrames } from '$lib/motion/gpu/shared-frames';
  import { drawFrame, prepare, type DisplayList, type Prepared } from '@feega/motion-core/motion/gpu-full/display-list';
  import { smoothingOf } from '@feega/motion-core/motion/gpu-full/text/painter';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
  import { CoreMotion, createCore, createCoreGl, dropCore, type CoreRaster } from '@feega/motion-core/motion/gpu-full/core-web';
  import { createCoreNative, nativeCanvasOffered } from '@feega/motion-core/motion/gpu-full/core-native';
  import { createMedia, Readiness, VideoPreload, videoUses } from '@feega/motion-core/motion/gpu-full/media';
  import { createRamPreview, type FrameRange } from '@feega/motion-core/motion/gpu-full/ram-preview';
  import { SpatialIndex } from '$lib/canvas/core/spatial-index';
  import { Outcome } from '@feega/motion-core/motion/gpu-full/core-outcome';
  import { dotBackground, type Viewport } from '$lib/canvas/dot-grid';
  import { ItemKind } from '@feega/motion-core/motion/gpu-full/display-list';
  import { FramePacer } from '$lib/canvas/core/frame-pacer';
  import { PART_ITEMS, parts } from '$lib/canvas/core/group-parts';
  import { spliceOf } from '@feega/motion-core/canvas/core/group-diff';
  import { storedTiles, tilesOn } from '$lib/canvas/core/tiles-switch';
  import { cacheZoom, cached, uncached, pictureBytes, resident, heldWhileMoving, type HeldFrame } from '$lib/canvas/core/residency';
  import { BUDGET, buildLanes, currentDevice, textureBudget } from '$lib/canvas/gpu/memory-budget';
  import { worldUses, type Turn } from '$lib/canvas/core/screen-uses';
  import { NO_SIGHT, sameSight, sightOf, slackened, stillHolds, widened, type Sight, type Taken } from '$lib/canvas/core/sight';
  import { SentParts, SentUses } from '$lib/canvas/core/use-diff';
  import { NO_OVERLAY, type CoreOverlay } from '$lib/canvas/core/world-overlay';
  import { memoSources } from '$lib/canvas/core/source-memo';
  import { retiered, retiers } from '$lib/canvas/core/retier';
  import { drawsAny, frameOfLive, logGaps, onStage, sameLive, shownGroup, stagedBox, toBuild, toWarm, untilFound, frameSourceUrl, type FrameAt } from '$lib/canvas/core/frame-source';
  import type { FrameOnCanvas } from '$lib/canvas/core/canvas-scene';
  import { postersFor, showsPoster } from '$lib/canvas/core/frame-poster';
  import { readPool } from '$lib/canvas/core/read-pool';
  import { grabThumb, posterBlob, posterSize, thumbClip, thumbList, thumbRect, thumbSize, thumbStore, thumbsDue } from '$lib/canvas/core/frame-thumbs';
  import { listed } from '$lib/canvas/core/frame-lists';
  import { frameBuilder, type FrameDoc } from '$lib/canvas/core/frame-build';
  import { liveGenerations } from '$lib/canvas/core/live-generations';
  import { latestOnly } from '$lib/canvas/core/latest-only';
  import { heldBuilds } from '$lib/canvas/core/held-build';
  import { customPictures as customPicturesOf } from '$lib/canvas/core/custom-pictures';
  import { frameSources } from '$lib/canvas/core/frame-sources';
  import { tieredAssets } from '$lib/canvas/core/tiered-assets';
  import { Reach, assetTier, keptTier } from '$lib/canvas/core/asset-tier';
  import type { AssetSize } from '$lib/canvas/asset-url';
  import { gestureWatch, whenQuiet } from '$lib/canvas/core/gesture-quiet';
  import { backendLog, debugActive, debugStart, gestureLog, renderLog, tierLog } from '$lib/canvas/core/debug-log';
  import { readClips, type CustomFrame, type CustomReads } from '@feega/motion-core/motion/gpu-full/dom/custom';
  import type { Picture, Pictures } from '@feega/motion-core/motion/gpu-full/raster';
  import { Stand, drawable, fillOrder, firstDrawn, inView, layersOf, onScreenFirst, placeholder, standIn, withoutPictures, type Look } from '$lib/canvas/core/placeholders';
  import { OnScreen, VectorGate, showStaged, shownBefore } from '$lib/canvas/core/staged-show';
  import { uploadWithin } from '$lib/canvas/core/picture-uploads';
  import { Step, markFrame, noteImages } from '$lib/canvas/core/frame-timeline';
  import { StartupStep, markStartup, reportFramesShown } from '$lib/canvas/core/startup-marks';
  import LoadTimeline from './LoadTimeline.svelte';
  import type { LiveDoc } from '$lib/canvas/core/live-docs.svelte';
  import { baseNodeId, withoutViews } from '$lib/canvas/breakpoint-views';
  import { loadOnce, withScenes, type LoadScene } from '$lib/canvas/scene-sources';
  import { describe, factsOf, signatureOf, undrawn, type NodeFacts } from '$lib/canvas/core/core-debug';
  import { Motion, hudLine, watchCrashes } from '$lib/canvas/gpu/crash-watch';
  import { startCanvasPerf } from '$lib/canvas/perf/perf-beacon';
  import { Camera } from '$lib/canvas/perf/session-perf';
  import { liftOut, liftedPut, movingGroup, restGroup, type Lift, type Lifted } from '$lib/canvas/core/lifted-drag';
  import { AttachStep, GpuBackend, afterAttachFailure, backendAfterLoss, isTrap, type BackendSwitch } from '$lib/canvas/gpu/gpu-loss';

  type CoreCard = { key: string; frame: FrameOnCanvas; turn?: Turn };


  let { frames, edited = new Set(), order = [], live = new Map(), known = () => null, cards = [], posters = [], overlay = NO_OVERLAY, lift = null, look = { paper: '#ffffff', line: '#e5e5e5' }, view, area, place = null, sourceUrl, onready, onsource = () => {}, onthumb = () => {}, onfallback, onbackend = () => {} }: { frames: FrameAt[]; edited?: ReadonlySet<string>; order?: readonly string[]; live?: ReadonlyMap<string, LiveDoc>; known?: (f: FrameAt) => FrameDoc | null; cards?: CoreCard[]; posters?: CoreCard[]; overlay?: CoreOverlay; lift?: Lift | null; look?: Look; view: Viewport; area: { width: number; height: number }; place?: { projectId: string; canvasId: string; orgId?: string; userId?: string; look?: string } | null; sourceUrl: (id: string) => string; onready: (ids: Set<string>) => void; onsource?: (id: string, source: FrameDoc) => void; onthumb?: (id: string, revision: number, blob: Blob, size: { width: number; height: number }) => void; onfallback: (why: string) => void; onbackend?: (change: BackendSwitch) => void } = $props();

  markStartup(StartupStep.Mounted);
  debugStart();

  const NATIVE = { name: GpuBackend.Native, create: createCoreNative };
  const WEBGPU = { name: GpuBackend.WebGpu, create: createCore };
  const WEBGL = { name: GpuBackend.WebGl, create: createCoreGl };
  const BACKENDS = nativeCanvasOffered() ? [NATIVE, WEBGPU, WEBGL] : [WEBGPU, WEBGL];
  const budget = BUDGET[currentDevice()];

  let canvas = $state<HTMLCanvasElement | null>(null);
  let backend = $state(0);
  let attempt = $state(0);
  let freshCores = 0;
  let raster = $state<CoreRaster | null>(null);
  let lists = $state(new Map<string, DisplayList>());
  const asked = new Set<string>();
  const put = new Set<string>();
  const pictured = new Set<string>();
  const putting = new Map<string, { parts: DisplayList[]; next: number }>();
  const media = createMedia({ videoPreload: VideoPreload.Metadata, frames: sharedFrames() });
  let tier = $state(assetTier(untrack(() => view.zoom)));
  $effect(() => {
    tier = assetTier(view.zoom);
  });
  $effect(() => tierLog(tier, untrack(() => view.zoom)));
  let sight = $state.raw<Sight>(NO_SIGHT);
  const imaged = new Set<string>();
  const baseKey = (f: FrameAt) => `${f.id}:${f.revision}:${place?.look ?? ''}${f.linked ? `:${f.linked}` : ''}${f.scenes ? `:${f.scenes}` : ''}`;
  const tieredKey = (f: FrameAt, at: AssetSize) => (imaged.has(f.id) ? `${baseKey(f)}:${at}` : baseKey(f));
  const bestTier = new Map<string, AssetSize>();
  const tierOf = (f: FrameAt) => keptTier(tier, bestTier.get(f.id), sight.near.has(f.id) ? Reach.Near : Reach.Far);
  const keyOf = (f: FrameAt) => tieredKey(f, tierOf(f));
  const resolution = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, budget.resolution);
  const crashes = watchCrashes({ device: currentDevice(), dpr: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, resolution });
  const RASTERED = new Set<Outcome>([Outcome.Full, Outcome.Partial]);
  const perf = startCanvasPerf({ canvasId: untrack(() => place?.canvasId ?? ''), device: currentDevice(), dpr: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, frames: () => frames.length });
  const EDIT_GIVE_UP_MS = 10_000;
  const editSeen = new Map<string, string>();
  const editsOwed = new Map<string, number>();
  let camera = Camera.Still;

  let readsHost = $state<HTMLDivElement | null>(null);
  const READ_LANES = 2;
  const READ_TIMEOUT_MS = 8000;
  const domRead = readPool({ lanes: READ_LANES, timeoutMs: READ_TIMEOUT_MS });
  const fromView = (f: FrameAt) => () => Math.hypot(view.x + (f.box.x + f.box.w / 2) * view.zoom - area.width / 2, view.y + (f.box.y + f.box.h / 2) * view.zoom - area.height / 2);
  const customPictures = customPicturesOf();
  const liveRead = (id: string) => `${id}:live`;
  const thumbs = thumbStore(place?.userId && place.orgId ? { userId: place.userId, orgId: place.orgId } : null, place?.canvasId ?? '');
  const thumbPictures = new Map<string, Picture>();
  const thumbAsked = new Set<string>();
  const thumbTaken = new Set<string>();
  const THUMB = ':thumb';
  const VECTORS = ':vectors';
  const pictures: Pictures = (item) => thumbPictures.get(item.clip) ?? customPictures.of(item) ?? media.pictures(item);

  async function mountReads(host: HTMLElement, source: FrameDoc, prepared: Prepared): Promise<CustomReads> {
    const [{ mountCustomReads }, { composeHtml, Target }, { Liveness }] = await Promise.all([import('@feega/motion-core/motion/gpu-full/dom/custom'), import('@feega/motion-core/motion/hyperframes/compose'), import('@feega/motion-core/motion/interactive/settings')]);
    return mountCustomReads(host, (only) => composeHtml({ doc: source.doc, tokens: source.tokens, assets: source.assets, liveness: Liveness.Baked, target: Target.Screen, only }), prepared);
  }

  async function readDom(f: FrameAt, source: FrameDoc, prepared: Prepared, frame: number): Promise<CustomFrame | null> {
    const host = readsHost;
    if (!host || !readClips(source.doc).read.length) {
      return null;
    }
    await whenQuiet(() => gesture.active() || edited.size > 0);
    return domRead(fromView(f), async (signal) => {
      const mounting = mountReads(host, source, prepared);
      signal.addEventListener('abort', () => void mounting.then((r) => r.dispose(), () => undefined));
      return (await mounting).readAt(frame);
    });
  }

  const smoothing = smoothingOf(navigator.userAgent);
  const lanes = buildLanes(currentDevice(), typeof navigator === 'object' ? navigator.hardwareConcurrency : 2);
  const buildAway = frameBuilder(() => (typeof Worker === 'function' ? (markStartup(StartupStep.WorkerSpawned), new Worker(new URL('../../../canvas/core/frame-build.worker.ts', import.meta.url), { type: 'module' })) : null), lanes);

  async function fetchScene(id: string): Promise<FrameDoc | null> {
    const res = await fetch(new URL(sourceUrl(id), location.href).href);
    return res.ok && res.status !== HTTP_NO_CONTENT ? ((await res.json()) as FrameDoc) : null;
  }

  const fetchedScenes = new Map<string, LoadScene>();
  const fetchedAt = (stamp: string) => fetchedScenes.get(stamp) ?? fetchedScenes.set(stamp, loadOnce(fetchScene)).get(stamp)!;

  const sceneSource =
    (stamp: string): LoadScene =>
    async (id) => {
      const held = live.get(id);
      return held ? { revision: 0, ...held } : fetchedAt(stamp)(id);
    };

  async function buildSource(f: FrameAt, given: FrameDoc): Promise<{ list: DisplayList; custom: CustomFrame | null }> {
    markFrame(f.id, Step.MainAsked);
    const source = await withScenes(given, sceneSource(f.scenes ?? ''));
    const fonts = await loadFonts(source.doc, source.assets, source.tokens);
    const prepared = prepare(source.doc, source.tokens, source.assets, { fonts, smoothing });
    const still = frameOfLive(source);
    const custom = await readDom(f, source, prepared, still).catch((e: unknown) => (console.warn('[canvas] core DOM read failed', f.id, e), null));
    markFrame(f.id, Step.MainBuild);
    const list = drawFrame(prepared, still, custom?.reads);
    markFrame(f.id, Step.MainBuilt);
    return { list, custom };
  }

  type HeldMain = { prepared: Prepared; reads: CustomReads | null };

  async function prepareMain({ f, source: given }: { f: FrameAt; source: FrameDoc }): Promise<HeldMain> {
    const source = await withScenes(given, sceneSource(f.scenes ?? ''));
    const fonts = await loadFonts(source.doc, source.assets, source.tokens);
    const prepared = prepare(source.doc, source.tokens, source.assets, { fonts, smoothing });
    const host = readsHost;
    if (!host || !readClips(source.doc).read.length) {
      return { prepared, reads: null };
    }
    return { prepared, reads: await mountReads(host, source, prepared) };
  }

  const mainOnly = new WeakSet<MotionDoc>();
  const heldMain = heldBuilds(prepareMain, (held) => held.reads?.dispose());

  async function liveOff(f: FrameAt, source: FrameDoc): Promise<DisplayList | null> {
    const away = f.scenes || mainOnly.has(source.doc) ? null : await buildAway(source, smoothing).catch(() => null);
    if (away) {
      return away;
    }
    mainOnly.add(source.doc);
    const held = await heldMain.of(f.id, [source.doc, source.tokens, source.assets, f.scenes], { f, source });
    const frame = frameOfLive(source);
    const custom = await held.reads?.readAt(frame).catch((e: unknown) => (console.warn('[canvas] core DOM read failed', f.id, e), null));
    if (custom) {
      customPictures.set(liveRead(f.id), custom.picture);
    }
    return drawFrame(held.prepared, frame, custom?.reads);
  }

  const RUNS_EVERY = 5;

  export async function cache(id: string, range: FrameRange, signal: AbortSignal, onRuns: (runs: FrameRange[]) => void) {
    const f = frames.find((x) => x.id === id);
    const held = live.get(id);
    if (!f || !held) {
      return;
    }
    const source = await withScenes({ revision: f.revision, ...held }, sceneSource(f.scenes ?? ''));
    const prepared = prepare(source.doc, source.tokens, source.assets);
    const ram = createRamPreview({ frames: sharedFrames(), uses: (frame) => videoUses(drawFrame(prepared, frame).items) });
    await ram.fill(range, signal, (done) => done % RUNS_EVERY === 0 && onRuns(ram.runs(range)));
    onRuns(ram.runs(range));
  }

  const sourceOf = (f: FrameAt) => frameSourceUrl(sourceUrl, f, place ?? {});

  const readSource = memoSources((f: FrameAt) => frameSources(sourceOf(f)));

  const builtTiers = new Map<string, { revision: number; at: AssetSize; list: DisplayList; custom: boolean }>();

  async function fetchAndBuild(f: FrameAt, at: AssetSize) {
    const fetched = await readSource(f);
    if (!fetched) {
      return null;
    }
    markFrame(f.id, Step.Source);
    const source = place ? tieredAssets(fetched, place, at) : fetched;
    if (source !== fetched && !imaged.has(f.id)) {
      imaged.add(f.id);
      asked.add(tieredKey(f, at));
    }

    const prior = builtTiers.get(f.id);
    if (place && prior && prior.revision === f.revision && prior.at !== at && !prior.custom) {
      const was = tieredAssets(fetched, place, prior.at).assets;
      const swap = new Map(Object.entries(source.assets).flatMap(([id, url]) => (was[id] && was[id] !== url ? [[was[id], url] as const] : [])));
      if (retiers(prior.list, swap)) {
        return { list: retiered(prior.list, swap), custom: null, source };
      }
    }
    const built = await builtOff(f, source);
    builtTiers.set(f.id, { revision: f.revision, at, list: built.list, custom: built.custom !== null });
    return { ...built, source };
  }

  async function builtOff(f: FrameAt, source: FrameDoc): Promise<{ list: DisplayList; custom: CustomFrame | null }> {
    const away = f.scenes ? null : await buildAway(source, smoothing).catch(() => null);
    return away ? { list: away, custom: null } : buildSource(f, source);
  }

  const HTTP_NO_CONTENT = 204;
  const STEP_WAIT_MS = 300;
  const UNSAVED_SOURCE = { tries: 8, waitMs: 1000 };
  const STEP_POLL_MS = 50;

  async function awaitKnown(f: FrameAt): Promise<FrameDoc | null> {
    for (let waited = 0; waited < STEP_WAIT_MS; waited += STEP_POLL_MS) {
      await new Promise((resolve) => setTimeout(resolve, STEP_POLL_MS));
      const given = known(f);
      if (given) {
        return given;
      }
    }
    return null;
  }

  async function load(f: FrameAt) {
    const at = tierOf(f);
    markFrame(f.id, Step.Asked);
    const given = known(f) ?? (loaded.get(f.id)?.endsWith(THUMB) === false ? await awaitKnown(f) : null);
    const read = given ? null : await untilFound(() => fetchAndBuild(f, at), UNSAVED_SOURCE);
    const built = given ? await buildSource(f, given) : read;
    if (!built) {
      return;
    }
    markFrame(f.id, Step.Built);
    markStartup(StartupStep.FirstBuilt);
    if (read) {
      onsource(f.id, { ...read.source, revision: f.revision });
    }
    const key = tieredKey(f, at);
    const held = shownBefore({ thumb: thumbShown.has(f.id), drawn: presented.has(f.id) });
    if (built.custom) {
      customPictures.set(key, built.custom.picture);
    }
    logGaps(f.id, built.list);
    asking.set(f.id, key);

    noteImages(f.id, built.list);
    const present = (ready: Readiness) => {
      if (asking.get(f.id) !== key) {
        return;
      }
      if (ready === Readiness.Whole) {
        bestTier.set(f.id, keptTier(at, bestTier.get(f.id), Reach.Near));
      }
      const group = ready === Readiness.Whole || held === OnScreen.Thumb ? key : `${key}${VECTORS}`;
      const shown = loaded.get(f.id);
      loaded.set(f.id, group);
      markFrame(f.id, ready === Readiness.Whole ? Step.Whole : Step.Vectors);
      lists = listed(lists, f.id, group, onStage(drawable(built.list, ready, look, (i) => !pictures(i)), f.kind), [groupOf(f), shown, drawnLast.get(f.id)?.group]);
    };
    void showStaged(media.ready(built.list), held, (ready) => (ready === Readiness.Whole ? vectorsFirst.after(() => present(ready)) : present(ready)));
  }

  const thumbLists = new Map<string, DisplayList>();
  let thumbShown = $state(new Map<string, HeldFrame>());
  const presented = new Set<string>();

  async function showThumb(f: FrameAt) {
    const key = baseKey(f);
    const blob = await thumbs.get(key);
    if (!blob || presented.has(f.id) || liveGroup.has(f.id)) {
      return;
    }
    const bitmap = await createImageBitmap(blob).catch(() => null);
    if (!bitmap || presented.has(f.id) || liveGroup.has(f.id)) {
      return;
    }
    thumbPictures.set(thumbClip(key), { source: bitmap, size: { width: bitmap.width, height: bitmap.height } });
    const group = `${key}${THUMB}`;
    markFrame(group, Step.Thumb);
    thumbTaken.add(key);
    thumbLists.set(group, thumbList(key, { width: f.box.w, height: f.box.h }));
    thumbShown = new Map(thumbShown).set(f.id, { id: f.id, group, box: f.box, size: { width: f.box.w, height: f.box.h }, bytes: 0, ...(f.turn ? { turn: f.turn } : {}) });
  }

  type PosterJob = { id: string; key: string; group: string; box: FrameAt['box']; revision: number; saved: boolean };
  const posterQueue: PosterJob[] = [];
  let posterRunning = false;

  function keepThumb(f: PosterJob, blob: Blob, size: { width: number; height: number }) {
    thumbs.put(f.key, blob);
    if (f.saved) {
      onthumb(f.id, f.revision, blob, size);
    }
  }

  function nextPoster() {
    const into = raster;
    const f = posterQueue[0];
    if (!into?.poster || !f) {
      posterRunning = false;
      return;
    }
    if (gesture.active()) {
      idle(nextPoster);
      return;
    }
    posterQueue.shift();
    const size = posterSize(f.box);
    void into
      .poster(f.group, size, size.scale)
      .then(posterBlob)
      .then((blob) => blob && keepThumb(f, blob, size))
      .catch((e: unknown) => console.warn('[canvas] poster not drawn', f.id, e))
      .finally(() => idle(nextPoster));
  }

  function startPosters() {
    if (posterRunning || !posterQueue.length) {
      return;
    }
    posterRunning = true;
    idle(nextPoster);
  }

  function takeThumbs(into: HTMLCanvasElement | null, shown: readonly HeldFrame[]) {
    if (!into) {
      return;
    }
    const drawn = frames.map((f) => ({ id: f.id, key: baseKey(f), group: groupOf(f), box: f.box, revision: f.revision, saved: !liveGroup.has(f.id) }));
    const offscreen = raster?.poster;
    for (const f of thumbsDue(shown, drawn, thumbTaken)) {
      if (offscreen) {
        thumbTaken.add(f.key);
        posterQueue.push(f);
        startPosters();
        continue;
      }
      const rect = thumbRect(f.box, view, area, resolution);
      if (!rect) {
        continue;
      }
      thumbTaken.add(f.key);
      void grabThumb(into, rect).then((blob) => {
        if (!blob) {
          return;
        }
        thumbs.put(f.key, blob);
        if (f.saved) {
          onthumb(f.id, f.revision, blob, thumbSize(rect));
        }
      });
    }
  }

  $effect(() => {
    const seen = slackened(sight.view, area);
    for (const f of fillOrder(frames, seen.view, seen.area)) {
      if (!thumbAsked.has(baseKey(f))) {
        thumbAsked.add(baseKey(f));
        void showThumb(f);
      }
    }
  });

  let liveGroup = $state(new Map<string, string>());
  const liveBuilt = new Map<string, LiveDoc>();
  const liveStamp = new Map<string, string | undefined>();
  const liveGeneration = liveGenerations();
  const liveAtRevision = new Map<string, number>();
  const groupOf = (f: FrameAt) => liveGroup.get(f.id) ?? keyOf(f);
  const loaded = new Map<string, string>();
  const asking = new Map<string, string>();
  const VECTORS_FIRST_MAX_MS = 8000;
  const vectorsFirst = new VectorGate();
  let lastShown = '';
  function reportShownOnce(shown: number, total: number) {
    const key = `${shown}/${total}`;
    if (key === lastShown) {
      return;
    }
    lastShown = key;
    reportFramesShown(shown, total);
  }
  setTimeout(() => vectorsFirst.settle([]), VECTORS_FIRST_MAX_MS);
  const shownOf = (f: FrameAt) => shownGroup(groupOf(f), loaded.get(f.id), (g) => lists.has(g));

  async function rebuildLive(f: FrameAt, source: LiveDoc) {
    const generation = liveGeneration.ask(f.id);
    const key = `${f.id}:live${generation}`;
    markFrame(key, Step.LiveAsked);
    const list = await liveOff(f, { revision: f.revision, ...source }).catch((e: unknown) => (console.warn('[canvas] core live frame failed', f.id, e), null));
    const built = list ? { list } : null;
    if (!built || !liveGeneration.newer(f.id, generation)) {
      return;
    }
    markFrame(key, Step.LiveBuilt);
    const ready = await media.ready(built.list);
    if (!liveGeneration.land(f.id, generation)) {
      return;
    }
    markFrame(key, Step.LiveReady);
    logGaps(f.id, built.list);
    lists = listed(lists, f.id, key, onStage(drawable(built.list, ready, look, (i) => !pictures(i)), f.kind), [groupOf(f), loaded.get(f.id), drawnLast.get(f.id)?.group]);
    liveGroup = new Map(liveGroup).set(f.id, key);
    liveAtRevision.set(f.id, f.revision);
  }

  const rebuildLatest = latestOnly<string, { f: FrameAt; source: LiveDoc }>((_id, { f, source }) => rebuildLive(f, source));

  $effect(() => {
    for (const f of frames) {
      const source = live.get(f.id);
      if (lift && !lift.landing && lift.id === baseNodeId(f.id)) {
        continue;
      }
      if (source && (!sameLive(liveBuilt.get(f.id), source) || liveStamp.get(f.id) !== f.scenes)) {
        liveBuilt.set(f.id, source);
        liveStamp.set(f.id, f.scenes);
        rebuildLatest(f.id, { f, source });
      }
    }
    for (const id of [...liveGroup.keys()].filter((id) => !live.has(id))) {
      liveBuilt.delete(id);
      heldMain.drop(id);
      customPictures.drop(liveRead(id));
      const saved = frames.find((f) => f.id === id);
      if (saved && saved.revision === liveAtRevision.get(id)) {
        continue;
      }
      const next = new Map(liveGroup);
      next.delete(id);
      liveGroup = next;
    }
  });

  let inFlight = $state(0);
  let settledFrames = $state(new Set<string>());

  $effect(() => {
    frameSources.warm(toWarm(withoutViews(frames), sight.view, area, keyOf, asked, liveGroup).filter((f) => !known(f)).map(sourceOf));
  });

  $effect(() => {
    const waiting = toBuild(withoutViews(frames), sight.view, area, keyOf, asked, liveGroup);

    const room = budget.framesInFlight - inFlight;
    if (room <= 0) {
      return;
    }
    const next = waiting.slice(0, room);
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
      const group = shownOf(f);
      const list = group ? lists.get(group) : undefined;
      return group && list && drawsAny(list) ? [{ id: f.id, group, box: stagedBox(f.box, list), size: { width: list.width, height: list.height }, bytes: pictureBytes(list.items), ...(f.turn ? { turn: f.turn } : {}) }] : [];
    })
  );
  const posterIds = $derived(new Set(posters.map((p) => p.frame.id)));
  const shownCards = $derived([...cards, ...postersFor(posters, new Set(framePuts.map((f) => f.id)))]);

  const cardIndex = $derived(new SpatialIndex(shownCards.map((c) => ({ id: c.key, ...c.frame.box }))));

  $effect(() => {
    const onScreen = cardIndex.visible(sight.view, area);
    for (const c of [...shownCards].sort((a, b) => Number(onScreen.has(b.key)) - Number(onScreen.has(a.key)))) {
      if (!cardLists.has(c.key) && !readying.has(c.key)) {
        readying.add(c.key);
        void media.ready(c.frame.list).then(() => (cardLists = new Map(cardLists).set(c.key, withoutPictures(c.frame.list, look, (i) => !pictures(i)))));
      }
    }
  });

  const cardPuts = $derived(shownCards.flatMap((c): HeldFrame[] => (cardLists.has(c.key) ? [{ id: c.frame.id, group: c.key, box: c.frame.box, size: { width: c.frame.list.width, height: c.frame.list.height }, bytes: pictureBytes(c.frame.list.items), turn: c.turn }] : [])));

  const whole = $derived([...cardPuts, ...framePuts]);
  const textureBytes = $derived(textureBudget(budget.textureBytes, { width: area.width * resolution, height: area.height * resolution }));
  const real = $derived(resident(whole, sight.view, area, textureBytes, budget.offscreen));

  const rank = $derived(new Map(order.map((id, i) => [id, i])));
  const stacking = (id: string) => rank.get(id) ?? 0;
  const standIns = $derived<{ id: string; box: FrameAt['box']; stand: Stand; turn?: Turn }[]>([...frames.map((f) => ({ id: f.id, box: f.box, stand: Stand.Frame, turn: f.turn })), ...cards.map((c) => ({ id: c.frame.id, box: c.frame.box, stand: Stand.Card, turn: c.turn }))].sort((a, b) => stacking(a.id) - stacking(b.id)));
  const placeholders = $derived(new Map(standIns.map((n) => [n.id, { ...n, ...placeholder(n.stand, { width: n.box.w, height: n.box.h }, look) }])));
  const BLOCKS = ':blocks';
  const blocksGroup = (key: string) => `${key}${BLOCKS}`;
  const cardBlocks = $derived(new Map(shownCards.filter((c) => !cardLists.has(c.key)).map((c) => [blocksGroup(c.key), { card: c, list: withoutPictures(c.frame.list, look) }])));
  const blocksById = $derived(new Map([...cardBlocks.entries()].map(([group, { card }]) => [card.frame.id, { id: card.frame.id, group, box: card.frame.box, size: { width: card.frame.list.width, height: card.frame.list.height }, bytes: 0, ...(card.turn ? { turn: card.turn } : {}) }])));

  const rebuilding = $derived(new Set([...shownCards.filter((c) => !cardLists.has(c.key)).map((c) => c.frame.id), ...frames.filter((f) => !lists.has(groupOf(f))).map((f) => f.id)]));
  const drawnLast = new Map<string, HeldFrame>();
  const lastSeen = new Map<string, number>();
  const placeIndex = $derived(new SpatialIndex([...placeholders.values()].map((p) => ({ id: p.id, ...p.box }))));
  const retained = (now: number) => {
    for (const id of sight.onScreen) {
      lastSeen.set(id, now);
    }
    const keep = new Set<string>();
    for (const [id, at] of lastSeen) {
      if (!placeholders.has(id)) {
        lastSeen.delete(id);
      } else if (now - at < budget.retainMs) {
        keep.add(id);
      }
    }
    return keep;
  };
  const bledBox = (box: FrameAt['box'], group: string) => {
    const list = listIfKnown(group);
    return list ? stagedBox(box, list) : box;
  };
  const chains = $derived.by(() => {
    const ready = new Map(real.map((f) => [f.id, f]));
    const holding = new Set([...rebuilding, ...retained(Date.now()), ...real.filter((f) => !pictured.has(f.group)).map((f) => f.id)]);
    for (const id of [...drawnLast.keys()].filter((id) => !holding.has(id))) {
      drawnLast.delete(id);
    }
    return [...placeholders.values()].map((p) => {
      const before = holding.has(p.id) ? drawnLast.get(p.id) : undefined;
      const turned = p.turn ? { turn: p.turn } : {};
      const head = ready.get(p.id);
      return layersOf<HeldFrame>({ ready: head && lists.has(head.group) ? head : null, poster: head && !lists.has(head.group) ? head : null, before: before && { ...before, box: bledBox(p.box, before.group), ...turned }, thumb: thumbShown.get(p.id), blocks: blocksById.get(p.id), placeholder: { id: p.id, group: p.group, box: p.box, size: { width: p.box.w, height: p.box.h }, bytes: 0, ...turned } });
    });
  });
  const held = $derived(chains.map((c) => c[0]));
  const nearTails = () => chains.filter((c) => sight.onScreen.has(c[0].id)).map((c) => c[c.length - 1]);
  const listOf = (group: string) => cardLists.get(group) ?? lists.get(group) ?? thumbLists.get(group) ?? cardBlocks.get(group)?.list ?? [...placeholders.values()].find((p) => p.group === group)!.list;

  const waiting = $derived.by(() => {
    const ready = new Set(real.map((f) => f.id));
    return inView([...placeholders.values()], sight.view, area).filter((p) => !ready.has(p.id) && !(p.stand === Stand.Frame && settledFrames.has(p.id) && !posterIds.has(p.id))).length;
  });

  $effect(() => {
    onready(new Set(chains.filter((c) => !c[0].group.endsWith(BLOCKS) && c[0].group !== c[c.length - 1].group).map((c) => c[0].id)));
  });

  let settled: Promise<unknown> = Promise.resolve();
  const surfaceWidth = $derived(Math.round(area.width * resolution));
  const surfaceHeight = $derived(Math.round(area.height * resolution));

  $effect(() => {
    const target = canvas;
    const width = surfaceWidth;
    const height = surfaceHeight;
    if (!target || !width || !height) {
      return;
    }
    let gone = false;
    let made: CoreRaster | null = null;
    const tried = backend;
    markStartup(StartupStep.GpuAsked);
    const attaching = settled.then(() => (gone ? null : BACKENDS[tried].create(target, width, height, budget.pictureSide)));
    void attaching.then(
      (r) => {
        if (!r) {
          return;
        }
        made = r;
        if (gone) {
          release(r);
          return;
        }
        put.clear();
        pictured.clear();
        putting.clear();
        sent = new SentUses();
        sentOverlay = new SentParts();
        r.setBudget?.(textureBudget(budget.textureBytes, { width, height }));
        r.setTileBudget?.(budget.tileBytes);
        r.setCanvasTiles?.(budget.canvasTiles);
        r.setPixelRatio?.(resolution);
        r.setTiles?.(TILED);
        raster = r;
        markStartup(StartupStep.GpuReady);
      },
      (e: unknown) => {
        if (gone) {
          return;
        }
        const next = afterAttachFailure(e, tried, freshCores, BACKENDS.length);
        if (next.step === AttachStep.GiveUp) {
          onfallback(e instanceof Error ? e.message : String(e));
          return;
        }
        if (next.step === AttachStep.FreshCore) {
          freshCores++;
          dropCore();
          attempt++;
          return;
        }
        switchTo(next.backend, e instanceof Error ? e.message : String(e));
      }
    );
    settled = attaching.then(
      () => undefined,
      () => undefined
    );
    return () => {
      gone = true;
      raster = null;
      if (made) {
        release(made);
      }
    };
  });

  let cacheBytes = 0;
  const IDLE_MS = 50;
  const PICTURES_PER_FRAME = 4;
  const UPLOAD_BUDGET_MS = 8;
  const PUT_BUDGET_MS = 8;
  const ITEMS_PER_FRAME = 2 * PART_ITEMS;
  let sent = new SentUses();
  let sentOverlay = new SentParts();
  const painted: Record<Outcome, number> = { [Outcome.Idle]: 0, [Outcome.Reused]: 0, [Outcome.Partial]: 0, [Outcome.Full]: 0 };

  let lifting: { key: number; group: string; lifted: Lifted | null } | null = null;
  const liftLists = new Map<string, DisplayList>();

  function dropLift(into: CoreRaster) {
    for (const group of liftLists.keys()) {
      into.dropGroup(group);
      put.delete(group);
      pictured.delete(group);
    }
    liftLists.clear();
    lifting = null;
  }

  function startLift(into: CoreRaster, now: Lift, group: string): Lifted | null {
    const list = listIfKnown(group);
    const lifted = list && put.has(group) ? liftOut(list, now.clips) : null;
    const [rest, moving] = [restGroup(group), movingGroup(group)];
    const patched = lifted !== null && into.patchGroup(group, rest, lifted.splice, pictures);
    lifting = { key: now.key, group, lifted: patched ? lifted : null };
    if (!patched) {
      return null;
    }
    into.putGroup(moving, lifted.moving, pictures);
    liftLists.set(rest, lifted.rest).set(moving, lifted.moving);
    for (const g of [rest, moving]) {
      put.add(g);
      pictured.add(g);
    }
    return lifted;
  }

  const liftHeld = (drawn: HeldFrame[]): ReadonlySet<string> => (liftLists.size && lift ? new Set([...edited, ...drawn.filter((l) => liftLists.has(l.group)).map((l) => l.id)]) : edited);

  function withLift(into: CoreRaster, shown: HeldFrame[]): HeldFrame[] {
    const at = lift ? shown.findIndex((l) => l.id === lift.id) : -1;
    const layer = shown[at];
    const stale = lifting && (!lift || lift.key !== lifting.key || layer?.group !== lifting.group);
    if (stale) {
      dropLift(into);
    }
    if (!lift || !layer || (lift.landing && !lifting)) {
      return shown;
    }
    const lifted = lifting ? lifting.lifted : startLift(into, lift, layer.group);
    if (!lifted) {
      return shown;
    }
    return [...shown.slice(0, at), { ...layer, group: restGroup(layer.group) }, liftedPut(layer, movingGroup(layer.group), lift.by), ...shown.slice(at + 1)];
  }

  const listIfKnown = (group: string) => liftLists.get(group) ?? cardLists.get(group) ?? lists.get(group) ?? thumbLists.get(group) ?? cardBlocks.get(group)?.list;

  function patchedFromSent(into: CoreRaster, group: string): number {
    const layers = chains.flat();
    const target = layers.find((f) => f.group === group);
    const base = target && layers.find((f) => f.id === target.id && f.group !== group && put.has(f.group));
    const [before, after] = [base && listIfKnown(base.group), listIfKnown(group)];
    const splice = before && after && spliceOf(before, after);
    if (!base || !splice || splice.items.length > PART_ITEMS || !into.patchGroup(base.group, group, splice, pictures)) {
      return 0;
    }
    put.add(group);
    markFrame(group, Step.Patched);
    return splice.items.length + 1;
  }

  function putPart(into: CoreRaster, group: string): number {
    const patched = putting.has(group) ? 0 : patchedFromSent(into, group);
    if (patched) {
      return patched;
    }
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
    markFrame(group, Step.Put);
    return part.items.length + 1;
  }

  const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('coreDebug');
  const TIMELINE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('loadTimeline');
  const TILED = typeof location !== 'undefined' && tilesOn(location.search, storedTiles());
  const MAX_LISTED = 12;
  const OVERSCAN_SHARE = 8;
  const OVERSCAN_MAX = 128;
  let debugSignature = '';
  let debugMoving = false;
  let debugFacts: NodeFacts[] = [];
  let hud = $state('');
  let pointer = { x: 0, y: 0 };

  const onScreen = (b: { x: number; y: number; w: number; h: number }) => b.x * view.zoom + view.x < area.width && (b.x + b.w) * view.zoom + view.x > 0 && b.y * view.zoom + view.y < area.height && (b.y + b.h) * view.zoom + view.y > 0;

  const GRID = 3;
  const SAMPLE_PX = 24;
  const ALPHA_VISIBLE = 8;
  let sampler: CanvasRenderingContext2D | null = null;

  function coverage(target: HTMLCanvasElement | null): string {
    sampler ??= Object.assign(document.createElement('canvas'), { width: GRID * SAMPLE_PX, height: GRID * SAMPLE_PX }).getContext('2d', { willReadFrequently: true });
    if (!target || !sampler) {
      return 'n/a';
    }
    sampler.clearRect(0, 0, GRID * SAMPLE_PX, GRID * SAMPLE_PX);
    sampler.drawImage(target, 0, 0, GRID * SAMPLE_PX, GRID * SAMPLE_PX);
    const px = sampler.getImageData(0, 0, GRID * SAMPLE_PX, GRID * SAMPLE_PX).data;
    const cells = Array.from({ length: GRID * GRID }, () => 0);
    for (let y = 0; y < GRID * SAMPLE_PX; y++) {
      for (let x = 0; x < GRID * SAMPLE_PX; x++) {
        const cell = Math.floor(y / SAMPLE_PX) * GRID + Math.floor(x / SAMPLE_PX);
        cells[cell] += px[(y * GRID * SAMPLE_PX + x) * 4 + 3] > ALPHA_VISIBLE ? 1 : 0;
      }
    }
    return cells.map((n) => (n / (SAMPLE_PX * SAMPLE_PX)).toFixed(2)).join(',');
  }

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
    const header = `zoom=${view.zoom.toFixed(3)} view=${Math.round(view.x)},${Math.round(view.y)} area=${Math.round(area.width)}x${Math.round(area.height)} retained=${refine} outcome=${outcome} caching=${zooming.active()} cacheBytes=${cacheBytes} held=${held.length} pictured=${pictured.size} put=${put.size}`;
    const signature = signatureOf(debugFacts);
    if (debugMoving && !moving) {
      console.info(`[core] gesture end ${header} coverage3x3=${coverage(canvas)} camera=${at0()}`);
      undrawn(debugFacts).slice(0, MAX_LISTED).forEach((f) => console.warn(`[core]   ${describe(f)}`));
    }
    if (signature !== debugSignature) {
      debugSignature = signature;
      console.warn(`[core] ${signature ? 'undrawn on screen' : 'all drawn again'} ${header} coverage3x3=${coverage(canvas)}`);
      undrawn(debugFacts).slice(0, MAX_LISTED).forEach((f) => console.warn(`[core]   ${describe(f)}`));
    }
    if (skipped.length) {
      console.warn(`[core] skipped ${skipped.slice(0, 6).join(' | ')}`);
    }
    debugMoving = moving;
    hud = hudText(header);
  }

  const at0 = () => `${Math.round(view.x * resolution)},${Math.round(view.y * resolution)},${(view.zoom * resolution).toFixed(3)}`;

  function hudText(header: string): string {
    const world = { x: (pointer.x - view.x) / view.zoom, y: (pointer.y - view.y) / view.zoom };
    const under = [...placeholders.values()].reverse().find((p) => world.x >= p.box.x && world.x <= p.box.x + p.box.w && world.y >= p.box.y && world.y <= p.box.y + p.box.h);
    const facts = under ? debugFacts.find((f) => f.id === under.id) : null;
    return `${hudLine(crashes.sample)}\n${header}\n${facts ? describe(facts) : 'no node under cursor'}`;
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

  let losses = 0;

  function switchTo(next: number, why: string) {
    const from = BACKENDS[backend].name;
    const to = BACKENDS[next].name;
    backendLog(from, to, why);
    onbackend({ from, to, why });
    backend = next;
  }

  function release(gone: CoreRaster) {
    try {
      gone.dispose();
    } catch (e) {
      console.warn('[core] raster of a lost core not released', e);
    }
  }

  function attachAgain(why: unknown) {
    console.warn('[core] gpu lost, attaching again', why);
    if (isTrap(why)) {
      dropCore();
    }
    losses++;
    perf.deviceLost();
    const next = backendAfterLoss(backend, losses, BACKENDS.length);
    if (next !== backend) {
      losses = 0;
      switchTo(next, why instanceof Error ? why.message : String(why));
    }
    raster = null;
    attempt++;
  }

  function paint(): boolean {
    const into = raster;
    if (!into) {
      return false;
    }
    try {
      if (into.lost()) {
        attachAgain('device lost');
        return false;
      }
      return paintOn(into);
    } catch (e) {
      attachAgain(e);
      return false;
    }
  }

  let sharpMarked = false;

  const deviceView = (): Viewport => ({ x: view.x * resolution, y: view.y * resolution, zoom: view.zoom * resolution });

  let owed: string[] = [];

  function uploadOwed(into: CoreRaster, groups: readonly string[]): string[] {
    const quiet = !gesture.active();
    const done = uploadWithin(quiet ? groups : groups.slice(0, PICTURES_PER_FRAME), (g) => into.upload(listOf(g), pictures, 1), () => performance.now(), quiet ? UPLOAD_BUDGET_MS : 0);
    for (const group of done) {
      pictured.add(group);
      markFrame(group, Step.Pictured);
    }
    owed = groups.filter((g) => !pictured.has(g));
    return done;
  }

  function stage(into: CoreRaster): HeldFrame[] {
    const tails = nearTails();
    const keep = new Set([...whole, ...chains.flat(), ...tails].map((f) => f.group).concat([...liftLists.keys()]));
    for (const group of [...put, ...putting.keys()].filter((g) => !keep.has(g))) {
      into.dropGroup(group);
      put.delete(group);
      putting.delete(group);
      pictured.delete(group);
    }
    const stopgaps = chains.flatMap((c) => (pictured.has(c[0].group) ? [] : c.filter((l) => thumbLists.has(l.group))));
    for (const f of [...tails, ...stopgaps]) {
      while (!put.has(f.group)) {
        putPart(into, f.group);
      }
    }
    let room = gesture.active() ? 0 : ITEMS_PER_FRAME;
    const putUntil = performance.now() + PUT_BUDGET_MS;
    const roomLeft = () => room > 0 || (!gesture.active() && performance.now() < putUntil);
    for (const f of onScreenFirst(held, view, area)) {
      while (roomLeft() && !put.has(f.group)) {
        room -= putPart(into, f.group);
      }
    }
    const unpictured = [...new Set([...tails, ...stopgaps, ...onScreenFirst(held, view, area)].filter((f) => put.has(f.group) && !pictured.has(f.group)).map((f) => f.group))];
    uploadOwed(into, unpictured);
    const shown = chains.flatMap((c) => {
      const layer = firstDrawn(c, pictured);
      return layer ? [layer] : [];
    });
    for (const layer of shown) {
      if (!layer.group.startsWith('placeholder') && !layer.group.endsWith(BLOCKS)) {
        if (lists.has(layer.group) || thumbLists.has(layer.group) || (posterIds.has(layer.id) && showsPoster(listOf(layer.group)))) {
          vectorsFirst.presented(layer.id);
        }
        if (lists.has(layer.group)) {
          presented.add(layer.id);
        }
        if (lists.has(layer.group) && thumbShown.has(layer.id)) {
          const next = new Map(thumbShown);
          next.delete(layer.id);
          thumbShown = next;
        }
        if (drawnLast.get(layer.id)?.group !== layer.group) {
          markFrame(layer.group, Step.Drawn);
          markStartup(StartupStep.FirstDrawn);
        }
        drawnLast.set(layer.id, layer);
      }
    }
    const drawn = withLift(into, shown);
    const at = deviceView();
    const device = { width: area.width * resolution, height: area.height * resolution };
    const wide = widened(at, device);
    const patch = sent.patch(worldUses(heldWhileMoving(zooming.active() || edited.size ? cached(drawn, wide.view, wide.area, textureBytes, cacheZoom(view.zoom) * resolution) : uncached(drawn), liftHeld(drawn))));
    if (patch) {
      into.patchUses(patch);
    }
    return shown;
  }

  let staleScene = true;
  let sceneBusy = true;
  let stagedCache = 0;
  let shown: HeldFrame[] = [];
  let thumbsOwed = false;
  let sharpOwed = false;

  const cacheAt = () => (zooming.active() || edited.size ? cacheZoom(view.zoom) : 0);
  const sceneDue = (quiet: boolean) => staleScene || (sceneBusy && quiet) || cacheAt() !== stagedCache;

  function restage(into: CoreRaster) {
    staleScene = false;
    stagedCache = cacheAt();
    shown = stage(into);
    sceneBusy = held.some((f) => !pictured.has(f.group));
    thumbsOwed = true;
    sharpOwed = !sharpMarked;
    const onScreenIds = fillOrder(frames, view, area).map((f) => f.id);
    if (frames.length) {
      reportShownOnce(vectorsFirst.shownOf(onScreenIds), onScreenIds.length);
    }
    if (frames.length && vectorsFirst.settle(onScreenIds)) {
      markFrame('all', Step.AllVectors);
    }
  }

  function settleEdits(now: number) {
    for (const [group, since] of editsOwed) {
      if (put.has(group)) {
        perf.edit(now - since);
      }
      if (put.has(group) || now - since > EDIT_GIVE_UP_MS) {
        editsOwed.delete(group);
      }
    }
  }

  $effect(() => {
    const now = performance.now();
    for (const f of frames) {
      const seen = `${baseKey(f)}|${liveGroup.get(f.id) ?? ''}`;
      const before = editSeen.get(f.id);
      editSeen.set(f.id, seen);
      if (before !== undefined && before !== seen) {
        editsOwed.set(untrack(() => groupOf(f)), now);
      }
    }
  });

  function paintOn(into: CoreRaster): boolean {
    const quiet = !gesture.active();
    if (sceneDue(quiet) || (sceneBusy && uploadOwed(into, owed).length)) {
      restage(into);
    }
    for (const part of quiet ? sentOverlay.changed(overlay) : []) {
      into.setOverlay(part, overlay[part]);
    }
    const at = deviceView();
    into.setMotion?.(quiet ? CoreMotion.Still : CoreMotion.Gesture);
    into.setCamera(at.x, at.y, at.zoom);
    const began = performance.now();
    const { outcome, pending, skipped } = into.frame(began);
    countFrame(began, into.frameCounts?.(), gesture.active(), pending);
    perf.frame(gesture.active() ? camera : Camera.Still, lift !== null, began);
    settleEdits(began);
    if (thumbsOwed && !pending && quiet) {
      thumbsOwed = false;
      takeThumbs(canvas, shown);
    }
    if (sharpOwed && !pending && held.length && held.every((f) => pictured.has(f.group) && lists.has(f.group) && !f.group.startsWith('placeholder') && !f.group.endsWith(THUMB) && !f.group.endsWith(VECTORS))) {
      sharpMarked = true;
      markFrame('all', Step.Sharp);
    }
    sharpOwed &&= pending;
    painted[outcome]++;
    cacheBytes = into.cacheBytes();
    if (canvas) {
      canvas.dataset.painted = `${painted[Outcome.Reused]},${painted[Outcome.Partial]},${painted[Outcome.Full]}`;
      canvas.dataset.cacheBytes = String(cacheBytes);
    }
    const tally = into.renderTally?.() ?? '{}';
    addTally(tally);
    if (debugActive()) {
      renderLog({ at: performance.now(), outcome, tally, cacheBytes, pending, moving: gesture.active() });
    }
    crashes.tick({ x: view.x, y: view.y, zoom: view.zoom, now: performance.now(), motion: gesture.active() ? Motion.Moving : Motion.Still, rastered: RASTERED.has(outcome) }, { cacheBytes, pictureBytes: into.pictureBytes(), scratchBytes: into.scratchBytes?.() ?? 0, wasmBytes: into.wasmBytes?.() ?? 0, width: canvas?.width ?? 0, height: canvas?.height ?? 0 });
    if (DEBUG) {
      (window as Window & { __gpuMem?: object }).__gpuMem = { ...crashes.sample, put: put.size, pictured: pictured.size };
      debugFrame(outcome, skipped, shown);
    }
    return pending || (into.warming?.() ?? false) || zooming.active() || (!quiet && sentOverlay.waiting(overlay)) || sceneBusy;
  }

  let ahead = false;
  const gesture = gestureWatch();
  let lastView = '';
  let lastZoom = 0;
  const zooming = gestureWatch();

  $effect(() => {
    const now = `${view.x},${view.y},${view.zoom}`;
    if (lastView && now !== lastView) {
      gesture.moved();
      camera = view.zoom !== lastZoom ? Camera.Zooming : Camera.Panning;
      gestureLog(view.zoom !== lastZoom ? 'zoom' : 'pan');
    }
    if (lastZoom && view.zoom !== lastZoom) {
      zooming.moved();
    }
    lastView = now;
    lastZoom = view.zoom;
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

  const pacer = new FramePacer(paint, (frame) => requestAnimationFrame(frame), () => raster?.busy?.() ?? false);

  let taken: Taken | null = null;
  let takenFrom: SpatialIndex | null = null;

  $effect(() => {
    if (placeIndex === takenFrom && taken && stillHolds(taken, view, area)) {
      pacer.invalidate();
      return;
    }

    taken = { view, area };
    takenFrom = placeIndex;
    const next = sightOf(placeIndex, view, area);
    if (!sameSight(untrack(() => sight), next)) {
      sight = next;
    }
    pacer.invalidate();
  });

  $effect(() => {
    void [raster, held, whole, edited, lift, sight, area.width, area.height];
    staleScene = true;
    pacer.invalidate();
  });

  $effect(() => {
    void overlay;
    pacer.invalidate();
  });

  $effect(() => () => media.dispose());
  $effect(() => () => crashes.stop());
  $effect(() => () => perf.stop());
  $effect(() => {
    if (raster) {
      perf.backend(BACKENDS[backend].name);
    }
  });

</script>

{#if DEBUG}
  <pre class="core-hud">{hud}</pre>
{/if}
{#if TIMELINE}
  <LoadTimeline />
{/if}
<div class="core-reads" bind:this={readsHost} aria-hidden="true"></div>
{#if !raster?.behindPage}
  <div class="core-grid" data-testid="core-grid" style={Object.entries(dotBackground(view)).map(([k, v]) => `${k}: ${v}`).join('; ')}></div>
{/if}
{#key `${backend}:${attempt}`}
  <canvas class="core-frames" bind:this={canvas} data-testid="core-canvas" data-held={held.length} data-waiting={waiting} data-frames={framePuts.length} data-cards={cardPuts.length} data-posters={cardPuts.length - cards.filter((c) => cardLists.has(c.key)).length} data-partial={[...lists.values()].filter((l) => l.unsupported.length).length}></canvas>
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
