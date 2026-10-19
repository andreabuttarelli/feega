<script lang="ts">
  import { AssetSize, canvasAssetUrl } from '$lib/canvas/asset-url';
  import { frameDrill } from '$lib/canvas/frame-drill';
  import { Gesture } from '$lib/motion/drill';
  import { onMount, untrack, type ComponentProps } from 'svelte';
  import { TILE_PAINTED } from '$lib/motion/hyperframes/measure';
  import { iconBitmap } from './icon-bitmap';
  import { idleChrome } from '$lib/canvas/gpu/idle-chrome';
  import { CONNECTOR_STYLE } from '$lib/canvas/connectors';
  import { NODE_TYPES, isNodeType, type NodeType } from '$lib/canvas/node-data';
  import { page } from '$app/state';
  import type CanvasFlow from '../CanvasFlow.svelte';
  import type { Tile } from '../CanvasFlow.svelte';
  import CanvasAddBar from '../CanvasAddBar.svelte';
  import CanvasDrawLayer from '../CanvasDrawLayer.svelte';
  import SelectionToolbar from '../SelectionToolbar.svelte';
  import NextStepChips from '../NextStepChips.svelte';
  import CanvasContextMenu from '../CanvasContextMenu.svelte';
  import ConnectPicker from '../ConnectPicker.svelte';
  import PageZoomLock from '../PageZoomLock.svelte';
  import NodeBoundary from '../NodeBoundary.svelte';
  import EdgePanel from '../EdgePanel.svelte';
  import GpuTileChrome from './GpuTileChrome.svelte';
  import RendererBadge from './RendererBadge.svelte';
  import CoreFrames from './CoreFrames.svelte';
  import { cardKey, cardsOnCanvas, portMarks, ringColour, type CardTile } from '$lib/canvas/core/card-source';
  import { coreText, type CoreText } from './core-text';
  import { NodeChrome, nodeChrome } from '$lib/canvas/selection-chrome';
  import { layersSource } from '$lib/canvas/layers-source.svelte';
  import { tileHovered } from '$lib/canvas/layers';
  import { framesOnCanvas } from '$lib/canvas/core/frame-source';
  import { overlayOf } from '$lib/canvas/core/world-overlay';
  import { peerOutlines } from '$lib/canvas/peer-outlines';
  import { displayName } from '$lib/realtime/frame-presence';
  import { dev } from '$app/environment';
  import Repeat from '@lucide/svelte/icons/repeat';
  import PeerLayer from '../PeerLayer.svelte';
  import { centreOf, viewportCentredOn } from '$lib/realtime/canvas-presence';
  import { setTileLive } from '$lib/canvas/tile-live-context';
  import { MOTION_NODE_BAR_H } from '$lib/canvas/motion-node';
  import { BarContext } from '$lib/canvas/bottom-bar';
  import { frameBar } from '$lib/canvas/frame-bar.svelte';
  import { DrawTool } from '$lib/motion/draw-tool';
  import { CANVAS_MODES, CanvasMode } from '$lib/canvas/canvas-mode';
  import { FIT_PADDING, READABLE_ZOOM } from '$lib/canvas/placement';
  import { FocusMode, inView, revealIn, frameIn, type Insets } from '$lib/canvas/free-area';
  import { ZoomStep, type CanvasZoom } from '$lib/canvas/page-zoom';
  import { Region, keyRegion } from '$lib/canvas/key-region.svelte';
  import { matchCanvasShortcut, preventable, type CanvasCommand } from '$lib/canvas/shortcuts';
  import { Stack } from '$lib/canvas/stacking';
  import { DropVerdict, pointOf } from '$lib/canvas/canvas-drop';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';
  import { CANVAS_DRAG_FILLED_NODE, CANVAS_DRAG_OUTPUT, parseFilledNodeDrag } from '$lib/canvas/drag-payload';
  import { isAddable, type Addable } from '$lib/canvas/addable';
  import { edgeKindsFor } from '$lib/canvas/connect-rules';
  import { connectionRefusal, landingOf, type Connection } from '$lib/canvas/connection-verdict';
  import { focusEdges } from '$lib/canvas/edge-focus';
  import { reportHref } from '$lib/reports/report-link';
  import { GraphScope } from '$lib/canvas/run-graph';
  import { ALIGN_ACTIONS, ALIGN_EDGE, canvasMenuIds, isCanvasAction, type AlignActionId, type CanvasActionId, type SelectionActionId } from '$lib/canvas/selection-actions';
  import { alignTiles, tidyTiles, type TileMove } from '$lib/canvas/align';
  import { tilesAt } from '$lib/canvas/tiles-at';
  import { tileGaps } from '$lib/canvas/measure';
  import { snapDrag, type SnapGuide, type SpacingGap } from '$lib/canvas/snap';

  import { dragOffset } from '$lib/canvas/duplicate-plan';
  import { enterFrame } from '$lib/canvas/enter-frame';
  import { Direction, siblingOf } from '$lib/motion/siblings';
  import type { Edge } from '$lib/motion/space';
  import MeasureLayer from '../MeasureLayer.svelte';
  import type { GenPropertyType } from '$lib/canvas/common-properties';
  import type { GenMedium } from '$lib/canvas/gen-node';
  import type { CanvasEdgeKind, FlowEdge, WireMode } from '$lib/canvas-edges';
  import { setTileRender } from '$lib/canvas/tile-render-context';
  import { setTileResize } from '$lib/canvas/tile-resize-context';
  import { setTileRotate } from '$lib/canvas/tile-rotate-context';
  import type { Viewport } from '$lib/canvas/dot-grid';
  import { panBy, toWorld, visibleIds, zoomAt, type Point } from '$lib/canvas/gpu/camera';
  import { PORT_OFFSET, PortSide, edgeAt, portAt, portsOf, resizeCornerAt, wireCurve, type Box, type Corner, type Port } from '$lib/canvas/gpu/geometry';
  import { GestureKind, HitKind, Pointer, clicked, gestureFor, marqueeBox, marqueePick, movedBy, resized, type Hit } from '$lib/canvas/gpu/gesture';
  import { faceOf, handedToCore } from '$lib/canvas/gpu/card-face';
  import { SpatialIndex } from '$lib/canvas/core/spatial-index';
  import { assetTier } from '$lib/canvas/core/asset-tier';
  import { Fling, type Glide } from '$lib/canvas/core/inertia';
  import { FramePacer } from '$lib/canvas/core/frame-pacer';
  import type { GpuScene, Card } from '$lib/canvas/gpu/scene';
  import { themeOf } from '$lib/canvas/gpu/theme';
  import { Backend, nextBackend } from '$lib/canvas/gpu/backend';
  import { backendOf } from '$lib/canvas/gpu/renderer-flag';
  import { Counter, count, exposeLoss, exposeReveal, exposeSettled, recordFrame } from '$lib/canvas/gpu/frame-stats';
  import { parkStuck, shelfIds } from '$lib/canvas/gpu/poster-shelf';
  import { BUDGET, currentDevice } from '$lib/canvas/gpu/memory-budget';
  import { domPainted, paintsDom } from '$lib/canvas/gpu/paint';
  import { isRunning, nextSnapshot, snapshotKey } from '$lib/canvas/gpu/snapshot-queue';
  import { cachedSnapshot, digest, latestSnapshot, remoteSnapshot, storeSnapshot, uploadSnapshot } from '$lib/canvas/gpu/snapshot-cache';
  import { revealIn as revealDelay } from '$lib/canvas/gpu/reveal-gate';
  import { CANVAS_LOAD_EVENT, LoadKind, claimLoad, loadTiming } from '$lib/canvas/gpu/load-timing';
  import { engineOf } from '$lib/motion/engine';
  import { track } from '$lib/analytics';
  import { NODE_KIND_ICON, NODE_KIND_LABEL, NameTag } from '$lib/canvas/node-label';
  import { followGroup } from '$lib/canvas/node-layout';

  let props: ComponentProps<typeof CanvasFlow> & { thumbsOf?: (id: string) => string[]; onfail?: (why: string) => void; cardPreviews?: Record<string, { hash: string; url: string }>; previewsAt?: string; core?: boolean; tileOver?: import('svelte').Snippet<[{ id: string }]> } = $props();

  const DOM_CAP = 6;
  const CORE = 'core';
  const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  const SHELF_TICK_MS = 5000;
  const MOVE_SLOP_PX = 3;
  const LONG_PRESS_MS = 500;
  const LABEL_CLEARANCE = 24;
  const WHEEL_ZOOM = 0.01;
  const STEP_ZOOM = 1.2;
  const FIT_MS = 250;
  const EDIT_MAX_ZOOM = 2;
  const MIN_ZOOM = 0.05;
  const MAX_ZOOM = 4;
  const INTERACTIVE = 'input, textarea, select, button, a, [contenteditable="true"], .nodrag, video, audio, iframe';

  const tiles = $derived(props.tiles ?? []);
  const mode = $derived(props.mode ?? CanvasMode.Edit);
  const spec = $derived(CANVAS_MODES[mode]);

  setTileRender(() => props.tile);
  setTileResize(() => props.onResize);
  setTileRotate(() => props.onRotate);
  setTileLive(() => props.onLive);

  let wrap = $state<HTMLDivElement | null>(null);
  let surface = $state<HTMLDivElement | null>(null);
  let scene = $state<GpuScene | null>(null);
  let failed = $state<string | null>(null);
  let lossNote = $state<string | null>(null);
  let view = $state<Viewport>({ x: 0, y: 0, zoom: 1 });

  $effect(() => {
    const at = view;
    untrack(() => props.onView?.(centreOf(at, screenSize())));
  });

  $effect(() => {
    const target = props.follow;
    if (target) {
      view = viewportCentredOn(target, untrack(() => screenSize()));
    }
  });
  let area = $state({ width: 0, height: 0 });
  let selected = $state<string[]>([]);
  let selectedEdge = $state<string | null>(null);
  let hovered = $state<string | null>(null);
  let overrides = $state<Map<string, Box>>(new Map());
  let copies = $state<Map<string, Box>>(new Map());
  let marquee = $state<Box | null>(null);
  let ghost = $state<{ from: Port; at: Point; ok: boolean } | null>(null);
  let refusal = $state<string | null>(null);
  let menuAt = $state<Point | null>(null);
  let picked = $state<{ edge: FlowEdge; screen: Point } | null>(null);
  let connectPickerAt = $state<Point | null>(null);
  let targeting = $state<string[] | null>(null);
  let space = $state(false);
  let gesturing = $state(false);
  let resizing = $state<ReadonlySet<string>>(new Set());
  let fitted = false;
  let known = new Set<string>();

  const assetUrl = (id: string) => canvasAssetUrl(page.params.projectId ?? '', page.params.canvasId ?? '', id, AssetSize.Full);
  const tier = $derived(assetTier(view.zoom));
  const tierUrl = (id: string) => canvasAssetUrl(page.params.projectId ?? '', page.params.canvasId ?? '', id, tier);

  const placed = $derived([...tiles.filter((t) => t.behind), ...tiles.filter((t) => !t.behind)].map((t) => ({ ...t, ...(overrides.get(t.id) ?? {}) })));
  const byId = $derived(new Map(placed.map((t) => [t.id, t])));
  const summaries = $derived(new Map((props.nodeSummaries ?? []).map((n) => [n.id, n])));
  const ports = $derived(placed.flatMap((t) => portsOf(t)));
  const nodeOf = $derived(new Map(tiles.filter((t) => t.node).map((t) => [t.id, t.node!])));
  const lookup = (id: string) => nodeOf.get(id) ?? null;
  const edges = $derived(focusEdges(props.edges ?? [], selected) ?? props.edges ?? []);
  const editIds = $derived(new Set(selected.slice(0, DOM_CAP)));
  let drawn = $state(new Set<string>());
  let sticky = $state(new Map<string, number>());
  let wasEditing = new Set<string>();
  $effect(() => {
    const now = editIds;
    const left = [...wasEditing].filter((id) => !now.has(id));
    wasEditing = new Set(now);
    if (left.length) {
      untrack(() => (sticky = new Map([...sticky, ...left.map((id) => [id, Date.now()] as const)])));
    }
  });
  $effect(() => {
    const seen = visibleIds(placed.filter((t) => sticky.has(t.id)), view, area);
    const keep = new Map([...sticky].filter(([id]) => seen.has(id)));
    if (keep.size !== untrack(() => sticky.size)) {
      sticky = keep;
    }
  });
  const domIds = $derived.by(() => {
    const liveFrames = domPainted(placed.filter((t) => t.kind === 'motion' && !coreDrawn.has(t.id)), (id) => summaries.get(id)?.data ?? {}, view, area);
    const next = new Set([...editIds, ...sticky.keys(), ...liveFrames, ...(hoverLive ? [hoverLive] : []), ...(focusLive ? [focusLive] : [])]);
    return sameSet(lastDom, next) ? lastDom : (lastDom = next);
  });
  let lastDom = new Set<string>();
  let coreOn = $state(props.core ?? false);
  let coreDrawn = $state(new Set<string>());
  const coreFrames = $derived(coreOn ? framesOnCanvas(placed, (id) => summaries.get(id)?.data ?? {}) : []);
  let coreType = $state<CoreText | null>(null);
  $effect(() => {
    if (coreOn && !coreType) {
      void coreText(NODE_TYPES).then((t) => (coreType = t)).catch((e: unknown) => console.warn('[canvas] core text not loaded', e));
    }
  });
  const coreLook = $derived(wrap ? themeOf(wrap) : null);
  const drawsCard = (t: Tile) => !!t.kind && isNodeType(t.kind) && !handedOver(t);
  const drawCard = $derived(coreType && coreLook ? cardsOnCanvas({ ...coreLook, panel: coreLook.paper }, coreType.glyphs, coreType.bold) : null);
  const coreCards = $derived.by(() => {
    const text = coreType;
    const draw = drawCard;
    if (!coreOn || !text || !draw) {
      return [];
    }
    return placed.filter(drawsCard).flatMap((t) => {
      const card: CardTile = {
        id: t.id,
        box: { x: t.x, y: t.y, w: t.w, h: t.h },
        face: faceOf(t, summaries.get(t.id)?.data ?? {}, tierUrl, props.thumbsOf?.(t.id) ?? []),
        shot: coreShots.get(t.id) ?? null,
        ...portMarks(t),
        label: labelOf(t),
        icon: text.icons.get(t.kind as NodeType) ?? null
      };
      return [{ key: cardKey(card), frame: draw(card), turn: turnOf(t), poster: t.kind === 'motion' }];
    });
  });
  const turnOf = (t: Tile) => (t.rotation ? { degrees: t.rotation, about: { x: t.x + t.w / 2, y: t.y + t.h / 2 } } : undefined);
  const coreChrome = $derived.by(() => {
    const look = coreLook;
    if (!coreOn || !look) {
      return [];
    }
    return placed.flatMap((t) => {
      if (!coreDrawn.has(t.id)) {
        return [];
      }
      const on = selected.includes(t.id);
      const chrome = nodeChrome(t.id, on, layersSource.video);
      const hovered = !on && tileHovered(layersSource.hovered, t.id, layersSource.video?.nodeId ?? null);
      if (chrome.ring === NodeChrome.None && !hovered) {
        return [];
      }
      const marks = portMarks(t);
      return [{ id: t.id, x: t.x, y: t.y, width: t.w, height: t.h, ...marks, label: null, icon: null, ring: chrome.ring, handles: resizable && on && chrome.handles, hovered, ringColor: ringColour(marks, look), names: on, turn: turnOf(t) }];
    });
  });
  const posterCards = $derived(coreCards.filter((c) => c.poster));
  const nodeCards = $derived(coreCards.filter((c) => !c.poster));
  const coreSource = (id: string) => `/p/${page.params.projectId}/c/${page.params.canvasId}/motion/${id}/source`;
  let domShows = $state(new Set<string>());
  const handedOver = (t: Tile) => domIds.has(t.id) && (t.kind !== 'motion' || domShows.has(t.id));
  $effect(() => {
    const kept = [...untrack(() => domShows)].filter((id) => domIds.has(id));
    if (kept.length !== untrack(() => domShows.size)) {
      domShows = new Set(kept);
    }
  });
  $effect(() => {
    const el = wrap;
    if (!el) {
      return;
    }
    const painted = (e: Event) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('.gpu-dom-node')?.dataset.id;
      if (id && !domShows.has(id)) {
        domShows = new Set([...domShows, id]);
      }
    };
    el.addEventListener(TILE_PAINTED, painted);
    return () => el.removeEventListener(TILE_PAINTED, painted);
  });
  let hoverChrome = $state<string | null>(null);
  const chromeIds = $derived(new Set([...selected, ...domIds, ...(hoverChrome ? [hoverChrome] : []), ...(ghost ? [ghost.from.nodeId] : [])]));
  const labelOf = (t: Tile) => {
    const kind = t.kind && isNodeType(t.kind) ? t.kind : null;
    return t.tag === NameTag.Hidden ? null : t.displayName?.trim() || (kind ? NODE_KIND_LABEL[kind] : null);
  };
  const chromeOf = (t: Tile) => (chromeIds.has(t.id) ? null : idleChrome(t, labelOf(t), t.kind && isNodeType(t.kind) ? t.kind : null, (port) => CONNECTOR_STYLE[port].color));
  const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

  const SNAPSHOT_SETTLE_MS = 120;
  const SNAPSHOT_TIMEOUT_MS = 4000;
  const crossOrigin = (src: string) => {
    try {
      return new URL(src, location.href).origin !== location.origin;
    } catch {
      return false;
    }
  };
  const tainted = (canvas: HTMLCanvasElement) => {
    try {
      canvas.getContext('2d')?.getImageData(0, 0, 1, 1);
      return false;
    } catch {
      return true;
    }
  };
  const BUSY_MS = 400;
  const IDLE_SLICE_MS = 12;
  const QUIET_MAX_WAIT_MS = 5000;
  let busyUntil = 0;
  const markBusy = () => {
    busyUntil = performance.now() + BUSY_MS;
  };
  const quiet = (since = performance.now()) =>
    new Promise<void>((resolve) => {
      const check = (deadline?: IdleDeadline) => {
        const calm = performance.now() > busyUntil && (!deadline || deadline.timeRemaining() >= IDLE_SLICE_MS);
        if (calm || performance.now() - since > QUIET_MAX_WAIT_MS) {
          resolve();
          return;
        }
        if ('requestIdleCallback' in window) {
          requestIdleCallback(check, { timeout: BUSY_MS });
          return;
        }
        setTimeout(check, BUSY_MS);
      };
      check();
    });
  const withTimeout = <T,>(work: Promise<T>, ms: number) => Promise.race([work, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('snapshot timed out')), ms))]);
  const HOVER_INTENT_MS = 150;
  const SNAPSHOT_PIXEL_RATIO = 2;
  let hoverLive = $state<string | null>(null);
  let focusLive = $state<string | null>(null);
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let pictured = $state(new Map<string, string>());
  let shotJob = $state<string | null>(null);
  let shelfHost = $state<HTMLDivElement | null>(null);
  let fontCss: string | null = null;

  const snapshotKind = (t: Tile) => !!t.kind && t.kind !== 'motion' && paintsDom(t.kind, summaries.get(t.id)?.data ?? {});
  const shotKeyOf = (id: string) => {
    const t = byId.get(id);
    return t ? snapshotKey(t, summaries.get(id)?.data ?? {}, props.thumbsOf?.(id) ?? []) : '';
  };
  let shown = $state(new Map<string, string>());
  const shotOf = (id: string) => shown.get(id) ?? null;
  let coreShots = $state(new Map<string, string>());
  const shootsTiles = () => !!scene || coreOn;
  const showSnapshot = (id: string, key: string, bitmap: ImageBitmap) => {
    if (scene) {
      void scene.setSnapshot(id, key, bitmap).then(() => (shown = new Map(shown).set(id, key)));
      return;
    }
    void blobOf(bitmap).then((blob) => {
      const before = coreShots.get(id);
      coreShots = new Map(coreShots).set(id, URL.createObjectURL(blob));
      shown = new Map(shown).set(id, key);
      if (before) {
        URL.revokeObjectURL(before);
      }
    });
  };
  const preloaded = new Set<string>();
  let looking = $state(new Set<string>());
  const remote = new Map(Object.entries(props.cardPreviews ?? {}).map(([id, p]) => [id, p.hash]));
  const lookedUp = (id: string) => {
    const next = new Set(looking);
    next.delete(id);
    looking = next;
  };
  const publish = async (id: string, key: string, blob: Blob | null) => {
    const hash = await digest(key);
    if (!blob || !props.previewsAt || remote.get(id) === hash) {
      return;
    }
    remote.set(id, hash);
    await uploadSnapshot(props.previewsAt, id, key, blob);
  };
  const blobOf = async (bitmap: ImageBitmap) => {
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    c.getContext('2d')!.drawImage(bitmap, 0, 0);
    return c.convertToBlob({ type: 'image/webp', quality: 0.92 });
  };

  async function lookUp(t: Tile) {
    const key = untrack(() => shotKeyOf(t.id));
    const local = await latestSnapshot(t.id);
    if (local) {
      if (!shown.has(t.id)) {
        showSnapshot(t.id, local.key, local.bitmap);
      }
      if (local.key === key) {
        pictured = new Map(pictured).set(t.id, key);
        count(Counter.CachedSnapshot);
        void blobOf(local.bitmap).then((blob) => publish(t.id, key, blob));
      }
      return;
    }
    const far = props.cardPreviews?.[t.id];
    const bitmap = far ? await remoteSnapshot(far.url) : null;
    if (!far || !bitmap || shown.has(t.id)) {
      return;
    }
    showSnapshot(t.id, key, bitmap);
    if (far.hash === (await digest(key))) {
      pictured = new Map(pictured).set(t.id, key);
      count(Counter.CachedSnapshot);
    }
  }

  $effect(() => {
    if (!shootsTiles()) {
      return;
    }
    const fresh = placed.filter((t) => !preloaded.has(t.id) && snapshotKind(t));
    if (!fresh.length) {
      return;
    }
    untrack(() => {
      looking = new Set([...looking, ...fresh.map((t) => t.id)]);
    });
    for (const t of fresh) {
      preloaded.add(t.id);
      void lookUp(t).finally(() => lookedUp(t.id));
    }
  });

  let openedAt = 0;
  const mountedAt = performance.now();
  let loadTimer: ReturnType<typeof loadTiming> | null = null;
  function canvasLoadTiming(renderer: string) {
    const openedOn = new URL((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.name ?? location.href).pathname;
    const kind = claimLoad(openedOn, location.pathname);
    const origin = kind === LoadKind.Navigation ? 0 : mountedAt;
    return loadTiming({ kind, renderer, nodes: tiles.length, device: currentDevice(), engine: engineOf(navigator.userAgent), now: () => performance.now() - origin, raf: (frame) => requestAnimationFrame(frame), report: (r) => track(CANVAS_LOAD_EVENT, r) });
  }
  let revealed = $state(false);
  let revealTick = $state(0);
  const REVEAL_POLL_MS = 100;
  const domDrawn = (id: string) => !!wrap?.querySelector(`.gpu-dom-node[data-id="${id}"] [data-drawn="true"], .gpu-dom-node[data-id="${id}"] img.poster`);
  const previewed = (t: Tile) => {
    if (domIds.has(t.id)) {
      return t.kind !== 'motion' || domDrawn(t.id);
    }
    if (coreOn) {
      return coreDrawn.has(t.id);
    }
    if (snapshotKind(t)) {
      return shown.has(t.id) || !looking.has(t.id);
    }
    return !scene?.awaitsMedia(t.id);
  };
  const cullIndex = $derived(new SpatialIndex(placed));
  const unpreviewed = () => [...cullIndex.visible(view, area)].filter((id) => byId.get(id) && !previewed(byId.get(id)!));

  $effect(() => {
    void revealTick;
    if (revealed || !(scene || coreOn)) {
      return;
    }
    if (!area.width || (tiles.length && !fitted)) {
      const t = setTimeout(() => revealTick++, REVEAL_POLL_MS);
      return () => clearTimeout(t);
    }
    openedAt ||= performance.now();
    void drawn;
    void shown;
    void looking;
    const missing = unpreviewed();
    const wait = revealDelay(missing.length, performance.now() - openedAt);
    if (!wait) {
      revealed = true;
      exposeReveal(Math.round(performance.now() - openedAt), missing);
      loadTimer = spec.chrome ? canvasLoadTiming(scene?.backend ?? CORE) : null;
      loadTimer?.revealed(missing.length, performance.now() - openedAt);
      return;
    }
    const t = setTimeout(() => revealTick++, Math.min(wait, REVEAL_POLL_MS));
    return () => clearTimeout(t);
  });

  let settled = false;
  $effect(() => {
    void revealTick;
    void drawn;
    void shown;
    if (!revealed || settled) {
      return;
    }
    const missing = unpreviewed();
    if (!missing.length) {
      settled = true;
      exposeSettled(Math.round(performance.now() - openedAt));
      loadTimer?.settled();
      return;
    }
    const t = setTimeout(() => revealTick++, REVEAL_POLL_MS);
    return () => clearTimeout(t);
  });

  $effect(() => {
    const id = hovered;
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    if (!id || !byId.get(id) || !snapshotKind(byId.get(id)!)) {
      untrack(() => {
        if (hoverLive && !wrap?.querySelector(`.gpu-dom-node[data-id="${hoverLive}"]:hover, .gpu-dom-node[data-id="${hoverLive}"]:focus-within`)) {
          hoverLive = null;
        }
      });
      return;
    }
    hoverTimer = setTimeout(() => void quiet().then(() => (hoverLive = hovered === id ? id : hoverLive)), HOVER_INTENT_MS);
  });

  function trackFocus(e: FocusEvent) {
    focusLive = (e.target as HTMLElement | null)?.closest<HTMLElement>('.gpu-dom-node')?.dataset.id ?? null;
  }

  let schedulerTick = $state(0);
  $effect(() => {
    void schedulerTick;
    if (shotJob || !shootsTiles() || !BUDGET[currentDevice()].shootsSnapshots) {
      return;
    }
    if (performance.now() < busyUntil) {
      const t = setTimeout(() => schedulerTick++, BUSY_MS);
      return () => clearTimeout(t);
    }
    const due = placed.filter(snapshotKind);
    const seen = visibleIds(due, view, area);
    const s = screenSize();
    const next = nextSnapshot(due, shotKeyOf, untrack(() => pictured), seen, domIds, toWorld(view, { x: s.width / 2, y: s.height / 2 }));
    if (next) {
      shotJob = next;
    }
  });

  let shotMount = $state<string | null>(null);

  $effect(() => {
    const id = shotJob;
    if (!id) {
      return;
    }
    const key = untrack(() => shotKeyOf(id));
    let cancelled = false;
    const finish = () => {
      if (!cancelled) {
        pictured = new Map(pictured).set(id, key);
        shotMount = null;
        shotJob = null;
      }
    };
    void cachedSnapshot(key).then((bitmap) => {
      if (cancelled) {
        return;
      }
      if (bitmap && shootsTiles()) {
        showSnapshot(id, key, bitmap);
        count(Counter.CachedSnapshot);
        finish();
        return;
      }
      shotMount = id;
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const id = shotMount;
    const host = shelfHost;
    if (!id || !host) {
      return;
    }
    const key = untrack(() => shotKeyOf(id));
    let cancelled = false;
    void (async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await quiet();
      for (const img of host.querySelectorAll('img')) {
        img.loading = 'eager';
      }
      await withTimeout(Promise.all([...host.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined))), SNAPSHOT_TIMEOUT_MS).catch(() => undefined);
      await new Promise((r) => setTimeout(r, SNAPSHOT_SETTLE_MS));
      if (cancelled) {
        return;
      }
      const el = host.querySelector<HTMLElement>('.snapshot-node');
      try {
        if (el && shootsTiles()) {
          const { getFontEmbedCSS, toCanvas } = await import('html-to-image');
          fontCss ??= await withTimeout(getFontEmbedCSS(el), SNAPSHOT_TIMEOUT_MS);
          const options = { pixelRatio: SNAPSHOT_PIXEL_RATIO, fontEmbedCSS: fontCss, cacheBust: false, imagePlaceholder: PIXEL };
          const foreign = [...el.querySelectorAll('img')].some((img) => crossOrigin(img.currentSrc || img.src));
          const keep = (n: Node) => !(n instanceof HTMLImageElement && crossOrigin(n.currentSrc || n.src));
          await quiet();
          const canvas = await withTimeout(toCanvas(el, foreign ? { ...options, filter: keep } : options), SNAPSHOT_TIMEOUT_MS);
          if (foreign && tainted(canvas)) {
            throw new Error('tainted snapshot');
          }
          showSnapshot(id, key, await createImageBitmap(canvas));
          void storeSnapshot(id, key, canvas).then((blob) => publish(id, key, blob));
          count(Counter.Snapshot);
        }
      } catch (err) {
        console.warn(`[canvas] snapshot ${id}`, err);
      }
      if (!cancelled) {
        pictured = new Map(pictured).set(id, key);
        shotMount = null;
        shotJob = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  let parked = $state(new Map<string, number>());
  let shelfClock = $state(0);
  const shelf = $derived(new Set(coreOn ? [] : shelfIds(props.nodeSummaries ?? [], domIds, parked, shelfClock).slice(0, BUDGET[currentDevice()].posterShelf)));
  const shelfSince = new Map<string, number>();
  $effect(() => {
    const now = Date.now();
    for (const id of shelf) {
      if (!shelfSince.has(id)) {
        shelfSince.set(id, now);
      }
    }
    for (const id of [...shelfSince.keys()]) {
      if (!shelf.has(id)) {
        shelfSince.delete(id);
      }
    }
  });
  onMount(() => {
    const timer = setInterval(() => {
      shelfClock = Date.now();
      const next = parkStuck(shelfSince, parked, shelfClock);
      if (next.size !== parked.size || [...next].some(([id, at]) => parked.get(id) !== at)) {
        for (const id of next.keys()) {
          shelfSince.delete(id);
        }
        parked = next;
      }
    }, SHELF_TICK_MS);
    return () => clearInterval(timer);
  });

  function portFor(nodeId: string, side: PortSide, handle: string | null | undefined): Port | null {
    const own = ports.filter((p) => p.nodeId === nodeId && p.side === side);
    return own.find((p) => p.handle === (handle ?? null)) ?? own[0] ?? null;
  }

  const curves = $derived(
    edges.flatMap((e) => {
      const from = portFor(e.source, PortSide.Out, e.sourceHandle);
      const to = portFor(e.target, PortSide.In, e.targetHandle);
      return from && to ? [{ edge: e, curve: wireCurve({ x: from.x + PORT_OFFSET, y: from.y }, { x: to.x - PORT_OFFSET, y: to.y }) }] : [];
    })
  );

  function faceFor(t: Tile) {
    const face = faceOf(t, summaries.get(t.id)?.data ?? {}, assetUrl, props.thumbsOf?.(t.id) ?? []);
    return coreDrawn.has(t.id) ? handedToCore(face) : face;
  }

  const cards = $derived(
    placed.map(
      (t): Card => ({
        id: t.id,
        x: t.x,
        y: t.y,
        w: t.w,
        h: t.h,
        rotation: t.rotation ?? 0,
        face: faceFor(t),
        hidden: handedOver(t) || coreDrawn.has(t.id),
        snapshot: shotOf(t.id),
        running: isRunning(summaries.get(t.id)?.data ?? {}),
        chrome: coreDrawn.has(t.id) ? null : chromeOf(t)
      })
    )
  );

  const selectedBoxes = $derived(selected.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : [])));
  const resizable = $derived(selectedBoxes.length === 1 && selectedBoxes[0].minW != null && selectedBoxes[0].minH != null && spec.flow.nodesDraggable);

  const editing = $derived(props.barContext === BarContext.Frame);

  $effect(() => {
    scene?.setCards(cards);
  });

  const iconed = new Set<string>();
  $effect(() => {
    const target = scene;
    if (!target) {
      return;
    }
    for (const t of placed) {
      const kind = t.kind && isNodeType(t.kind) ? t.kind : null;
      if (!kind || iconed.has(kind)) {
        continue;
      }
      iconed.add(kind);
      void iconBitmap(NODE_KIND_ICON[kind] as never).then((bitmap) => target.setIcon(kind, bitmap)).catch(() => iconed.delete(kind));
    }
  });

  $effect(() => {
    const css = wrap ? getComputedStyle(wrap) : null;
    const level = (name: string) => Number(css?.getPropertyValue(name) || 1);
    scene?.setDim(editing ? { body: level('--neighbour-body'), edges: level('--neighbour-edges') } : null);
  });

  $effect(() => {
    const ghostCurve = ghost ? (ghost.from.side === PortSide.Out ? wireCurve(ghost.from, ghost.at) : wireCurve(ghost.at, ghost.from)) : null;
    scene?.setOverlay({
      selected: selectedBoxes,
      resizable,
      marquee: coreOn ? null : marquee,
      ghost: ghostCurve,
      ghostOk: ghost?.ok ?? false,
      hovered: hovered && !selected.includes(hovered) ? (byId.get(hovered) ?? null) : null,
      peers: []
    });
  });

  $effect(() => {
    scene?.setCamera(view);
  });

  $effect(() => {
    const incoming = tiles;
    untrack(() => adoptNew(incoming));
  });

  function adoptNew(incoming: Tile[]) {
    const added = incoming.filter((t) => !known.has(t.id));
    known = new Set(incoming.map((t) => t.id));
    const chosen = added.filter((t) => t.select).map((t) => t.id);
    if (chosen.length) {
      select(chosen);
    }
    const gone = selected.filter((id) => !known.has(id));
    if (gone.length) {
      select(selected.filter((id) => known.has(id)));
    }
    if (!fitted && (scene || coreOn) && incoming.length) {
      fitted = true;
      fitTo(incoming);
    }
  }

  let reported = '';
  function select(ids: string[]) {
    selected = ids;
    const key = ids.join(',');
    if (key === reported) {
      return;
    }
    reported = key;
    props.onSelectionChange?.(ids);
  }

  let surfaceRect: { width: number; height: number; left: number; top: number } | null = null;

  function measureSurface() {
    const r = surface?.getBoundingClientRect();
    surfaceRect = r ? { width: r.width, height: r.height, left: r.left, top: r.top } : null;
  }

  function screenSize() {
    if (!surfaceRect?.width) {
      measureSurface();
    }
    return surfaceRect ?? { width: innerWidth, height: innerHeight, left: 0, top: 0 };
  }

  function boundsOf(boxes: Box[]): { x: number; y: number; width: number; height: number } | null {
    if (!boxes.length) {
      return null;
    }
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, width: Math.max(...boxes.map((b) => b.x + b.w)) - x, height: Math.max(...boxes.map((b) => b.y + b.h)) - y };
  }

  function fitTo(boxes: Box[], maxZoom = READABLE_ZOOM) {
    const b = boundsOf(boxes);
    if (!b) {
      return;
    }
    const s = screenSize();
    const zoom = Math.max(MIN_ZOOM, Math.min(maxZoom, Math.min(s.width / (b.width * (1 + FIT_PADDING)), s.height / (b.height * (1 + FIT_PADDING)))));
    animateTo({ zoom, x: s.width / 2 - (b.x + b.width / 2) * zoom, y: s.height / 2 - (b.y + b.height / 2) * zoom });
  }

  let tween = 0;
  function animateTo(target: Viewport) {
    cancelAnimationFrame(tween);
    const from = view;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / FIT_MS);
      const e = 1 - Math.pow(1 - k, 3);
      view = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, zoom: from.zoom + (target.zoom - from.zoom) * e };
      if (k < 1) {
        tween = requestAnimationFrame(step);
      }
    };
    tween = requestAnimationFrame(step);
  }

  const toFlow = (p: Point): Point => {
    const s = screenSize();
    return toWorld(view, { x: p.x - s.left, y: p.y - s.top });
  };

  const selection = $derived.by(() => {
    const b = boundsOf(selectedBoxes);
    if (!b) {
      return { ids: selected, box: null, zoom: view.zoom };
    }
    const s = screenSize();
    const left = s.left + view.x + b.x * view.zoom;
    const top = s.top + view.y + (b.y - LABEL_CLEARANCE) * view.zoom;
    return { ids: selected, box: { x: left, y: top, width: b.width * view.zoom, height: (b.height + LABEL_CLEARANCE) * view.zoom }, zoom: view.zoom };
  });

  $effect(() => {
    const f = props.focus;
    const ids = f?.ids;
    if (!ids?.length) {
      return;
    }
    if (f?.mode === FocusMode.Select) {
      untrack(() => select([...ids]));
    }
    if (f?.mode !== FocusMode.Frame) {
      const b = untrack(() => boundsOf(ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))));
      const s = untrack(() => screenSize());
      if (b && untrack(() => inView(b, view, { width: s.width, height: s.height }, f?.free))) {
        return;
      }
      if (b && f?.mode === FocusMode.Reveal) {
        untrack(() => animateTo(revealIn(b, view, { width: s.width, height: s.height }, f?.free)));
        return;
      }
    }
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => untrack(() => focusOn(ids, f?.free ?? null))));
    return () => cancelAnimationFrame(frame);
  });

  function focusOn(ids: readonly string[], free: Insets | null) {
    const boxes = ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
    const b = boundsOf(boxes);
    if (!b) {
      return;
    }
    if (free) {
      const s = screenSize();
      animateTo(frameIn(b, { width: s.width, height: s.height }, free, EDIT_MAX_ZOOM));
      return;
    }
    fitTo(boxes);
  }

  type Active =
    | { kind: GestureKind.Pan; last: Point; moved: boolean }
    | { kind: GestureKind.Drag; id: string; start: Point; origins: Map<string, Point>; moved: boolean; toggle: boolean }
    | { kind: GestureKind.Resize; id: string; corner: Corner; start: Point; box: Box; min: { w: number; h: number } }
    | { kind: GestureKind.Marquee; start: Point; base: string[]; additive: boolean; moved: boolean }
    | { kind: GestureKind.Connect; from: Port }
    | { kind: GestureKind.PickEdge; edgeId: string };

  let active: Active | null = null;
  let downAt: Point = { x: 0, y: 0 };
  const touches = new Map<number, Point>();
  let pinch: { dist: number; mid: Point } | null = null;
  let press: ReturnType<typeof setTimeout> | null = null;
  let suppressMenu = false;
  let captureId: number | null = null;

  function local(e: { clientX: number; clientY: number }): Point {
    const s = screenSize();
    return { x: e.clientX - s.left, y: e.clientY - s.top };
  }

  const hitIndex = $derived(new SpatialIndex(placed.map((t) => (t.tag === NameTag.Hidden ? t : { id: t.id, x: t.x, y: t.y - LABEL_CLEARANCE, w: t.w, h: t.h + LABEL_CLEARANCE }))));

  const topNodeAt = (w: Point): string | null => hitIndex.topAt(w);

  function hitAt(w: Point): Hit {
    const port = spec.flow.nodesConnectable ? portAt(ports, w, view.zoom) : null;
    if (port) {
      return { kind: HitKind.Port, nodeId: port.nodeId, handle: port.handle };
    }
    if (resizable) {
      const corner = resizeCornerAt(selectedBoxes[0], w, view.zoom);
      if (corner) {
        return { kind: HitKind.Corner, nodeId: selectedBoxes[0].id, corner };
      }
    }
    const node = topNodeAt(w);
    if (node) {
      return { kind: HitKind.Node, nodeId: node };
    }
    const edge = edgeAt(curves.map((c) => ({ id: c.edge.id, curve: c.curve })), w, view.zoom);
    return edge ? { kind: HitKind.Edge, edgeId: edge } : { kind: HitKind.Empty };
  }

  function boxHit(hit: Hit, target: HTMLElement): Hit {
    const box = target.closest<HTMLElement>('.gpu-node')?.dataset.id;
    const overridable = hit.kind === HitKind.Node || hit.kind === HitKind.Empty || hit.kind === HitKind.Edge;
    return overridable && box ? { kind: HitKind.Node, nodeId: box } : hit;
  }

  function onClickInside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const id = target.closest<HTMLElement>('.gpu-dom-node')?.dataset.id;
    if (!id || !target.closest(INTERACTIVE) || !spec.flow.elementsSelectable || selected.includes(id)) {
      return;
    }
    clickNode(id, e.shiftKey || e.metaKey || e.ctrlKey);
  }

  function onDouble(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.gpu-dom-node [data-motion-node]')) {
      return;
    }
    const hit = hitAt(toWorld(view, local(e as PointerEvent)));
    const id = hit.kind === HitKind.Node ? hit.nodeId : null;
    if (id) {
      props.onNodeDoubled?.(id);
    }
    const stage = id ? wrap?.querySelector<HTMLElement>(`[data-motion-node="${id}"] [data-frame-stage]`)?.getBoundingClientRect() : null;
    if (!id || !stage || stage.width <= 0 || stage.height <= 0) {
      return;
    }
    frameDrill.request(id, { x: (e.clientX - stage.left) / stage.width, y: (e.clientY - stage.top) / stage.height }, Gesture.Double);
  }

  const pointerOf = (e: PointerEvent) => (e.pointerType === 'touch' ? Pointer.Touch : e.pointerType === 'pen' ? Pointer.Pen : Pointer.Mouse);

  const fling = new Fling();
  let glide: Glide | null = null;
  let glidedAt = 0;

  function glideStep(t: number): boolean {
    const d = glide?.step(glidedAt ? t - glidedAt : 0);
    glidedAt = t;
    if (!d) {
      glide = null;
      return false;
    }
    view = panBy(view, d);
    return true;
  }

  const glider = new FramePacer(glideStep, (frame) => requestAnimationFrame(frame));

  function startGlide() {
    glide = fling.release(performance.now());
    glidedAt = 0;
    glider.invalidate();
  }

  function onDown(e: PointerEvent) {
    glide = null;
    markBusy();
    measureSurface();
    const p = local(e);
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, p);
      if (touches.size === 2) {
        cancelGesture();
        pinch = pinchOf();
        return;
      }
    }
    const w = toWorld(view, p);
    const target = e.target as HTMLElement;
    const hit = boxHit(hitAt(w), target);
    const inDom = target.closest('.gpu-dom-node');
    if (inDom && hit.kind !== HitKind.Port && hit.kind !== HitKind.Corner && target.closest(INTERACTIVE)) {
      return;
    }
    if (e.button === 2 && hit.kind !== HitKind.Empty) {
      return;
    }
    const kind = gestureFor(hit, { pointer: pointerOf(e), button: e.button, shift: e.shiftKey, space, mode });
    downAt = p;
    suppressMenu = false;
    captureId = e.pointerId;
    holdSelection(true);
    menuAt = null;
    picked = null;
    startGesture(kind, hit, w, e);
    if (e.pointerType === 'touch' && hit.kind === HitKind.Node) {
      const at = { x: e.clientX, y: e.clientY };
      press = setTimeout(() => openMenu(hit.nodeId, at), LONG_PRESS_MS);
    }
  }

  function startGesture(kind: GestureKind, hit: Hit, w: Point, e: PointerEvent) {
    const START: Record<GestureKind, () => Active | null> = {
      [GestureKind.Pan]: () => {
        fling.release(e.timeStamp);
        fling.sample(local(e), e.timeStamp);
        return { kind: GestureKind.Pan, last: local(e), moved: false };
      },
      [GestureKind.Drag]: () => {
        if (hit.kind !== HitKind.Node) {
          return null;
        }
        const ids = selected.includes(hit.nodeId) && !e.shiftKey ? selected : clicked(selected, hit.nodeId, e.shiftKey || e.metaKey || e.ctrlKey);
        const origins = new Map(ids.flatMap((id) => (byId.get(id) ? [[id, { x: byId.get(id)!.x, y: byId.get(id)!.y }] as const] : [])));
        return { kind: GestureKind.Drag, id: hit.nodeId, start: w, origins, moved: false, toggle: e.shiftKey || e.metaKey || e.ctrlKey };
      },
      [GestureKind.Resize]: () => {
        if (hit.kind !== HitKind.Corner) {
          return null;
        }
        const t = byId.get(hit.nodeId)!;
        return { kind: GestureKind.Resize, id: t.id, corner: hit.corner, start: w, box: { x: t.x, y: t.y, w: t.w, h: t.h }, min: { w: t.minW ?? 1, h: t.minH ?? 1 } };
      },
      [GestureKind.Marquee]: () => ({ kind: GestureKind.Marquee, start: w, base: selected, additive: e.shiftKey || e.metaKey || e.ctrlKey, moved: false }),
      [GestureKind.Connect]: () => {
        if (hit.kind !== HitKind.Port) {
          return null;
        }
        const from = ports.find((p) => p.nodeId === hit.nodeId && p.handle === hit.handle && Math.hypot(p.x - w.x, p.y - w.y) * view.zoom < 12) ?? portAt(ports, w, view.zoom);
        if (!from) {
          return null;
        }
        ghost = { from, at: w, ok: false };
        return { kind: GestureKind.Connect, from };
      },
      [GestureKind.PickEdge]: () => (hit.kind === HitKind.Edge ? { kind: GestureKind.PickEdge, edgeId: hit.edgeId } : null)
    };
    active = START[kind]();
    gesturing = active !== null;
  }

  function pinchOf(): { dist: number; mid: Point } {
    const [a, b] = [...touches.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  function candidate(from: Port, w: Point): Connection | null {
    const port = portAt(ports, w, view.zoom);
    const node = port?.nodeId ?? topNodeAt(w);
    if (!node || node === from.nodeId) {
      return null;
    }
    if (from.side === PortSide.Out) {
      return { source: from.nodeId, sourceHandle: from.handle, target: node, targetHandle: port?.side === PortSide.In ? port.handle : null };
    }
    return { source: node, sourceHandle: port?.side === PortSide.Out ? port.handle : null, target: from.nodeId, targetHandle: from.handle };
  }

  function onMove(e: PointerEvent) {
    if (active || e.buttons) {
      markBusy();
    }
    const p = local(e);
    props.onPointer?.(toWorld(view, p));
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      if (pinch && touches.size === 2) {
        const next = pinchOf();
        props.onUserPan?.();
        view = panBy(zoomAt(view, next.mid, next.dist / pinch.dist), { x: next.mid.x - pinch.mid.x, y: next.mid.y - pinch.mid.y });
        pinch = next;
        return;
      }
    }
    const w = toWorld(view, p);
    if (!active) {
      hovered = e.pointerType === 'mouse' ? topNodeAt(w) : null;
      hoverChrome = e.pointerType === 'mouse' ? (hovered ?? portAt(ports, w, view.zoom)?.nodeId ?? null) : null;
      return;
    }
    const far = Math.hypot(p.x - downAt.x, p.y - downAt.y) > MOVE_SLOP_PX;
    if (far && press) {
      clearTimeout(press);
      press = null;
    }
    if (far && captureId !== null) {
      surface?.setPointerCapture(captureId);
      captureId = null;
    }
    const MOVE: Record<GestureKind, (a: Active) => void> = {
      [GestureKind.Pan]: (a) => {
        if (a.kind !== GestureKind.Pan) {
          return;
        }
        props.onUserPan?.();
        view = panBy(view, { x: p.x - a.last.x, y: p.y - a.last.y });
        fling.sample(p, e.timeStamp);
        a.last = p;
        a.moved ||= far;
        suppressMenu ||= far;
      },
      [GestureKind.Drag]: (a) => {
        if (a.kind !== GestureKind.Drag || (!far && !a.moved) || !spec.flow.nodesDraggable) {
          return;
        }
        if (!a.moved) {
          a.moved = true;
          if (!selected.includes(a.id) || a.toggle) {
            select([...a.origins.keys()]);
          }
        }
        const next = new Map<string, Box>();
        const raw = movedBy(a.origins, { x: w.x - a.start.x, y: w.y - a.start.y });
        const moved = snapMoves(raw);
        const all = new Map(tiles.map((t) => [t.id, { x: t.x, y: t.y }]));
        const follow = moved.flatMap((m) => followGroup(all, m.id, m, byId.get(m.id)?.members ?? []));
        for (const m of [...moved, ...follow]) {
          const t = byId.get(m.id);
          if (t) {
            next.set(m.id, { x: m.x, y: m.y, w: t.w, h: t.h });
          }
        }
        if (e.altKey) {
          copies = next;
          overrides = new Map();
        } else {
          overrides = next;
          copies = new Map();
        }
        props.onLive?.(moved.map((m) => ({ id: m.id, x: m.x, y: m.y })));
        props.onTileDragOver?.([...a.origins.keys()], pointOf(e));
      },
      [GestureKind.Resize]: (a) => {
        if (a.kind !== GestureKind.Resize) {
          return;
        }
        resizing = resizing.has(a.id) ? resizing : new Set([a.id]);
        overrides = new Map([[a.id, resized(a.box, a.corner, { x: w.x - a.start.x, y: w.y - a.start.y }, a.min)]]);
      },
      [GestureKind.Marquee]: (a) => {
        if (a.kind !== GestureKind.Marquee || (!far && !a.moved)) {
          return;
        }
        a.moved = true;
        marquee = marqueeBox(a.start, w);
        select(marqueePick(placed, marquee, a.base, a.additive));
      },
      [GestureKind.Connect]: (a) => {
        if (a.kind !== GestureKind.Connect) {
          return;
        }
        const c = candidate(a.from, w);
        const why = c ? connectionRefusal(tiles, edges, lookup, c) : '';
        refusal = why || null;
        ghost = { from: a.from, at: w, ok: c !== null && why === null };
      },
      [GestureKind.PickEdge]: () => {}
    };
    MOVE[active.kind](active);
  }

  function holdSelection(on: boolean) {
    document.documentElement.classList.toggle('canvas-gesture', on);
    if (on) {
      getSelection()?.removeAllRanges();
    }
  }

  function onUp(e: PointerEvent) {
    holdSelection(false);
    touches.delete(e.pointerId);
    captureId = null;
    if (touches.size < 2) {
      pinch = null;
    }
    if (press) {
      clearTimeout(press);
      press = null;
    }
    const a = active;
    active = null;
    gesturing = false;
    resizing = new Set();
    if (!a) {
      return;
    }
    const w = toWorld(view, local(e));
    const END: Record<GestureKind, () => void> = {
      [GestureKind.Pan]: () => {
        if (a.kind === GestureKind.Pan && !a.moved && e.button === 0) {
          clearSelection();
        }
        if (a.kind === GestureKind.Pan && a.moved && coreOn) {
          startGlide();
        }
      },
      [GestureKind.Drag]: () => {
        if (a.kind !== GestureKind.Drag) {
          return;
        }
        if (!a.moved) {
          clickNode(a.id, a.toggle);
          return;
        }
        endDrag([...a.origins.keys()], e);
      },
      [GestureKind.Resize]: () => {
        if (a.kind !== GestureKind.Resize) {
          return;
        }
        const box = overrides.get(a.id);
        if (box && (box.x !== a.box.x || box.y !== a.box.y)) {
          props.onMove?.(a.id, box.x, box.y);
        }
        if (box) {
          props.onResize?.(a.id, box.w, box.h);
        }
        settleOverrides();
      },
      [GestureKind.Marquee]: () => {
        marquee = null;
        if (a.kind === GestureKind.Marquee && !a.moved) {
          clearSelection();
        }
      },
      [GestureKind.Connect]: () => {
        if (a.kind !== GestureKind.Connect) {
          return;
        }
        const c = candidate(a.from, w);
        ghost = null;
        refusal = null;
        if (!c || connectionRefusal(tiles, edges, lookup, c) !== null) {
          return;
        }
        const landing = landingOf(tiles, lookup, c);
        if (landing) {
          props.onConnect?.(landing.source, landing.target, landing.kind, landing.targetHandle, landing.sourceHandle);
        }
      },
      [GestureKind.PickEdge]: () => {
        if (a.kind !== GestureKind.PickEdge) {
          return;
        }
        const edge = edges.find((x) => x.id === a.edgeId);
        selectedEdge = a.edgeId;
        select([]);
        if (edge) {
          picked = { edge, screen: { x: e.clientX, y: e.clientY } };
        }
      }
    };
    END[a.kind]();
  }

  function cancelGesture() {
    active = null;
    gesturing = false;
    resizing = new Set();
    marquee = null;
    ghost = null;
    refusal = null;
    settleOverrides();
  }

  function settleOverrides() {
    overrides = new Map();
    copies = new Map();
  }

  function clearSelection() {
    selectedEdge = null;
    targeting = null;
    select([]);
  }

  function clickNode(id: string, toggle: boolean) {
    props.onNodeClicked?.(id);
    selectedEdge = null;
    if (targeting) {
      if (!targeting.includes(id)) {
        props.onConnectExisting?.(targeting, id);
        targeting = null;
      }
      return;
    }
    select(clicked(selected, id, toggle));
  }

  function endDrag(ids: string[], e: PointerEvent) {
    snapGuides = [];
    snapSpacing = [];
    props.onLive?.([]);
    if (props.onTileDrop?.(ids, pointOf(e)) === DropVerdict.Taken) {
      settleOverrides();
      return;
    }
    const grabbed = copies.get(ids[0]) ?? overrides.get(ids[0]);
    const copyOffset = e.altKey && grabbed ? dragOffset(new Map(tiles.map((t) => [t.id, { x: t.x, y: t.y }])), { id: ids[0], position: grabbed }) : undefined;
    if (copyOffset && props.onDuplicate) {
      settleOverrides();
      props.onDuplicate(ids, copyOffset);
      return;
    }
    const moves = ids.flatMap((id) => (overrides.get(id) ? [{ id, x: overrides.get(id)!.x, y: overrides.get(id)!.y }] : []));
    for (const m of moves) {
      props.onMove?.(m.id, m.x, m.y);
    }
    props.onMoveEnd?.(moves);
    settleOverrides();
  }

  function onWheel(e: WheelEvent) {
    glide = null;
    markBusy();
    props.onUserPan?.();
    const target = e.target as HTMLElement;
    if (target.closest('.gpu-dom-node .nowheel')) {
      return;
    }
    e.preventDefault();
    const p = local(e);
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      view = zoomAt(view, p, Math.exp(-e.deltaY * WHEEL_ZOOM));
      return;
    }
    if (!spec.flow.panOnScroll) {
      view = zoomAt(view, p, Math.exp(-e.deltaY * WHEEL_ZOOM));
      return;
    }
    view = panBy(view, { x: -e.deltaX, y: -e.deltaY });
  }


  const SNAP_SCREEN_PX = 6;
  let snapGuides = $state<SnapGuide[]>([]);
  const corePeers = $derived(coreOn && coreType ? (props.peers ?? []).filter((p) => !p.chat) : []);
  const coreRotate = $derived(coreOn && props.onRotate ? selectedBoxes.filter((t) => t.rotatable && !t.rotation).map((t) => ({ id: t.id, box: { x: t.x, y: t.y, w: t.w, h: t.h } })) : []);
  const coreOverlay = $derived(
    coreOn && coreLook && coreType
      ? overlayOf({
          curves,
          selected,
          selectedEdge,
          marquee,
          guides: snapGuides,
          zoom: view.zoom,
          theme: { ...coreLook, panel: coreLook.paper },
          glyphs: coreType.glyphs,
          peers: corePeers.flatMap((p) => (p.cursor ? [{ id: p.sessionId, name: displayName(p.name), color: p.colour, at: p.cursor }] : [])),
          outlines: corePeers.length ? peerOutlines(props.peers ?? [], (id) => byId.get(id) ?? null).map((o) => ({ key: o.key, box: o.rect, color: o.colour })) : [],
          rotate: coreRotate,
          ghost: ghost ? { curve: ghost.from.side === PortSide.Out ? wireCurve(ghost.from, ghost.at) : wireCurve(ghost.at, ghost.from), ok: ghost.ok } : null,
          hovered: hovered && !selected.includes(hovered) ? (byId.get(hovered) ?? null) : null,
          running: placed.filter((t) => !handedOver(t) && isRunning(summaries.get(t.id)?.data ?? {})),
          chrome: coreChrome
        })
      : []
  );
  let snapSpacing = $state<SpacingGap[]>([]);
  let altHeld = $state(false);

  function snapMoves(raw: TileMove[]): TileMove[] {
    const ids = new Set(raw.map((m) => m.id));
    const rects = raw.flatMap((m) => (byId.get(m.id) ? [{ id: m.id, x: m.x, y: m.y, w: byId.get(m.id)!.w, h: byId.get(m.id)!.h }] : []));
    const others = tiles.filter((t) => !ids.has(t.id)).map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
    const snap = snapDrag(rects, others, SNAP_SCREEN_PX / view.zoom);
    snapGuides = snap.guides;
    snapSpacing = snap.spacing;
    const at = new Map(snap.moves.map((m) => [m.id, m]));
    return raw.map((m) => at.get(m.id) ?? m);
  }

  const measured = $derived.by(() => {
    const over = hovered && altHeld ? byId.get(hovered) : null;
    return over ? tileGaps(selectedBoxes, over) : [];
  });

  const placedBoxes = (ids: string[]) => ids.flatMap((id) => (byId.get(id) ? [{ id, x: byId.get(id)!.x, y: byId.get(id)!.y, width: byId.get(id)!.w, height: byId.get(id)!.h }] : []));

  function placeTiles(moves: TileMove[]) {
    if (!moves.length) {
      return;
    }
    for (const m of moves) {
      props.onMove?.(m.id, m.x, m.y);
    }
    props.onMoveEnd?.(moves);
  }

  const alignSelection = (ids: string[], edge: Edge) => placeTiles(alignTiles(placedBoxes(ids), edge));
  const alignRun = (id: AlignActionId) => (ids: string[]) => alignSelection(ids, ALIGN_EDGE[id]);

  function selectSibling(direction: Direction) {
    const next = siblingOf(placed.map((t) => t.id), selected, direction);
    if (next) {
      select([next]);
    }
  }

  let menuLayers = $state<{ id: string; label: string }[]>([]);
  const tileLabel = (t: Tile) => t.displayName || NODE_KIND_LABEL[t.kind as keyof typeof NODE_KIND_LABEL] || t.kind || t.id;

  function layersAt(at: Point): { id: string; label: string }[] {
    return tilesAt(placed, toFlow(at)).flatMap((id) => (byId.get(id) ? [{ id, label: tileLabel(byId.get(id)!) }] : []));
  }

  function openMenu(id: string, at: Point) {
    if (!selected.includes(id)) {
      select([id]);
    }
    menuLayers = layersAt(at);
    menuAt = at;
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (suppressMenu || !spec.chrome) {
      return;
    }
    const node = topNodeAt(toWorld(view, local(e)));
    if (node) {
      openMenu(node, { x: e.clientX, y: e.clientY });
      return;
    }
    if (selected.length) {
      menuAt = { x: e.clientX, y: e.clientY };
      menuLayers = layersAt(menuAt);
    }
  }

  function dropSelection(ids: string[], edgeIds: string[]) {
    picked = null;
    for (const id of edgeIds) {
      props.onEdgeDelete?.(id);
    }
    if (ids.length) {
      props.onDelete?.(ids);
    }
  }

  function viewCentre(): Point {
    const s = screenSize();
    return toFlow({ x: s.left + s.width / 2, y: s.top + s.height / 2 });
  }

  const zoomStep = (factor: number) => {
    const s = screenSize();
    view = zoomAt(view, { x: s.width / 2, y: s.height / 2 }, factor);
  };

  const ZOOM_RUN: Record<ZoomStep, () => void> = {
    [ZoomStep.In]: () => zoomStep(STEP_ZOOM),
    [ZoomStep.Out]: () => zoomStep(1 / STEP_ZOOM),
    [ZoomStep.Fit]: () => fitTo(placed)
  };

  const pageZoom: CanvasZoom = {
    step: (step) => {
      if (keyRegion.current === Region.Canvas) {
        ZOOM_RUN[step]();
      }
    },
    scaleBy: (factor) => zoomStep(factor)
  };

  function nudge(dx: number, dy: number) {
    for (const id of selected) {
      const t = byId.get(id);
      if (t) {
        props.onMove?.(id, t.x + dx, t.y + dy);
      }
    }
  }

  const KEY_RUN: Record<CanvasCommand['id'], (c: CanvasCommand) => void> = {
    add: (c) => c.id === 'add' && addAtCentre(c.what),
    nudge: (c) => c.id === 'nudge' && nudge(c.dx, c.dy),
    align: (c) => c.id === 'align' && placeTiles(alignTiles(placedBoxes(selected), c.edge)),
    tidy: () => placeTiles(tidyTiles(placedBoxes(selected))),
    enter: () => {
      const only = selected.length === 1 ? selected[0] : null;
      if (only) {
        enterFrame(only, String(summaries.get(only)?.data.kind ?? '') || undefined);
      }
    },
    'select-next': () => selectSibling(Direction.Next),
    'select-previous': () => selectSibling(Direction.Previous),
    tool: (c) => {
      if (c.id === 'tool') {
        frameBar.tool = c.tool;
      }
    },
    delete: () => (selected.length || selectedEdge) && dropSelection(selected, selectedEdge ? [selectedEdge] : []),
    deselect: () => clearSelection(),
    'select-all': () => select(placed.map((t) => t.id)),
    fit: () => fitTo(placed),
    'zoom-actual': () => {
      const s = screenSize();
      view = zoomAt(view, { x: s.width / 2, y: s.height / 2 }, 1 / view.zoom);
    },
    'zoom-selection': () => selectedBoxes.length && fitTo(selectedBoxes),
    'zoom-in': () => zoomStep(STEP_ZOOM),
    'zoom-out': () => zoomStep(1 / STEP_ZOOM),
    duplicate: () => selected.length && props.onDuplicate?.(selected),
    copy: () => selected.length && props.onCopy?.(selected),
    paste: () => props.onPaste?.(viewCentre()),
    undo: () => props.onUndo?.(),
    redo: () => props.onRedo?.(),
    group: () => props.onGroup?.(selected),
    ungroup: () => props.onUngroup?.(selected),
    'bring-front': () => props.onRestack?.(selected, Stack.Front),
    'send-back': () => props.onRestack?.(selected, Stack.Back)
  };

  function onKeydown(e: KeyboardEvent) {
    markBusy();
    altHeld = e.altKey;
    if (e.key === ' ' && !(e.target as HTMLElement).closest?.(INTERACTIVE)) {
      space = true;
    }
    if (e.key === 'Escape') {
      picked = null;
      refusal = null;
      connectPickerAt = null;
      targeting = null;
    }
    if (!spec.chrome || keyRegion.current !== Region.Canvas) {
      return;
    }
    const command = matchCanvasShortcut(e);
    if (!command) {
      return;
    }
    if (preventable(command)) {
      e.preventDefault();
    }
    KEY_RUN[command.id](command);
  }

  const SELECTION_RUN: Record<CanvasActionId, (ids: string[]) => void> = {
    'tidy-up': (ids) => placeTiles(tidyTiles(placedBoxes(ids))),
    ...(Object.fromEntries(ALIGN_ACTIONS.map((id) => [id, alignRun(id)])) as Record<AlignActionId, (ids: string[]) => void>),
    duplicate: (ids) => props.onDuplicate?.(ids),
    'connect-new': () => {
      if (selection.box) {
        connectPickerAt = { x: selection.box.x + selection.box.width + 24, y: selection.box.y };
      }
    },
    'connect-existing': (ids) => {
      targeting = ids;
    },
    'run-workflow': (ids) => props.onRunWorkflow?.(ids),
    'run-downstream': (ids) => props.onRunGraph?.(GraphScope.Downstream, ids),
    'run-stale': (ids) => props.onRunGraph?.(GraphScope.Stale, ids),
    'copy-id': (ids) => void navigator.clipboard?.writeText(ids.join('\n')),
    report: (ids) => void window.open(reportHref({ node: ids[0] }), '_blank', 'noopener'),
    group: (ids) => props.onGroup?.(ids),
    ungroup: (ids) => props.onUngroup?.(ids),
    copy: (ids) => props.onCopy?.(ids),
    paste: () => menuAt && props.onPaste?.(toFlow(menuAt)),
    'bring-front': (ids) => props.onRestack?.(ids, Stack.Front),
    'send-back': (ids) => props.onRestack?.(ids, Stack.Back),
    'create-formats': (ids) => props.onCreateFormats?.(ids[0]),
    export: (ids) => props.onExport?.(ids),
    delete: (ids) => props.onDelete?.(ids)
  };

  function runSelectionAction(id: SelectionActionId) {
    if (selected.length && isCanvasAction(id)) {
      SELECTION_RUN[id](selected);
    }
  }

  const selectedSummaries = $derived((props.nodeSummaries ?? []).filter((n) => selected.includes(n.id)));
  const selectionEdges = $derived(edges.map((e) => ({ sourceNodeId: e.source, targetNodeId: e.target })));
  const selectionMedium = $derived(
    selectedSummaries.length && selectedSummaries.every((n) => n.type === selectedSummaries[0].type) ? (selectedSummaries[0].type as GenPropertyType) : null
  );
  const pickedKinds = $derived(picked ? edgeKindsFor(lookup, picked.edge.source, picked.edge.target, picked.edge.sourceHandle) : []);

  function addAtCentre(what: Addable) {
    props.onCreate?.(what, viewCentre());
  }

  function pickConnectMedium(medium: GenMedium) {
    if (connectPickerAt) {
      props.onConnectNew?.(selected, medium);
      connectPickerAt = null;
    }
  }

  function pickNextStep(s: { createsNodeType: 'video' | 'text' | 'image' | null; wiring: 'connect-new' | 'create-post'; promptTemplate: string }) {
    if (s.wiring === 'create-post' || !s.createsNodeType) {
      return;
    }
    props.onConnectNew?.(selected, s.createsNodeType, s.promptTemplate);
  }

  const OS_FILES = 'Files';

  function onDragOver(e: DragEvent) {
    const types = e.dataTransfer?.types ?? [];
    if (![CANVAS_DRAG_FILLED_NODE, CANVAS_DRAG_MEDIUM, CANVAS_DRAG_OUTPUT, OS_FILES].some((type) => types.includes(type))) {
      return;
    }
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  }

  function onDrop(e: DragEvent) {
    const at = { x: e.clientX, y: e.clientY };
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length && props.onUpload) {
      e.preventDefault();
      files.forEach((file) => props.onUpload?.(file));
      return;
    }
    const output = e.dataTransfer?.getData(CANVAS_DRAG_OUTPUT);
    if (output) {
      e.preventDefault();
      props.onDropOutput?.(output, at, toFlow(at));
      return;
    }
    const filled = parseFilledNodeDrag(e.dataTransfer?.getData(CANVAS_DRAG_FILLED_NODE) ?? '');
    if (filled) {
      e.preventDefault();
      props.onCreateFilled?.(filled, toFlow(at));
      return;
    }
    const what = e.dataTransfer?.getData(CANVAS_DRAG_MEDIUM);
    if (what && isAddable(what)) {
      e.preventDefault();
      props.onCreate?.(what, toFlow(at));
    }
  }

  function retype(kind: CanvasEdgeKind) {
    if (picked) {
      props.onEdgeRetype?.(picked.edge.id, kind);
      picked = null;
    }
  }

  function retypeMode(m: WireMode) {
    if (picked) {
      props.onEdgeModeChange?.(picked.edge.id, m);
      picked = { ...picked, edge: { ...picked.edge, mode: m } };
    }
  }

  onMount(() => {
    let alive = true;
    let built: GpuScene | null = null;
    const observer = new ResizeObserver(() => {
      measureSurface();
      built?.resize();
      area = { width: surface!.clientWidth, height: surface!.clientHeight };
    });
    const start = (backend: Backend) =>
      import('$lib/canvas/gpu/scene')
        .then(({ GpuScene }) => GpuScene.create(surface!, backend, themeOf(wrap!)))
        .then((s) => {
          if (!alive) {
            s.destroy();
            return;
          }
          built = s;
          s.onFrame = recordFrame;
          s.onReady = (shown) => (drawn = shown);
          s.onLost = () => recover(s);
          exposeLoss(() => s.loseForTest());
          scene = s;
          console.info(`[canvas] renderer ${s.backend}`);
          props.onFlow?.(toFlow);
          observer.observe(surface!);
          if (!fitted && tiles.length) {
            view = fitView(tiles);
          }
          fitted = true;
        })
        .catch((err: unknown) => {
          failed = err instanceof Error ? err.message : String(err);
          props.onfail?.(failed);
        });
    const recover = (lost: GpuScene) => {
      const next = nextBackend(lost.backend);
      console.warn(`[canvas] ${lost.backend} context lost → ${next ?? 'dom'}`);
      lossNote = `${lost.backend} lost`;
      scene = null;
      built = null;
      try {
        lost.destroy();
      } catch {
        lost.canvas.remove();
      }
      if (!next) {
        props.onfail?.('GPU context lost');
        return;
      }
      void start(next);
    };
    bootScene = () => void start(backendOf(page.url));
    if (coreOn) {
      observer.observe(surface!);
      props.onFlow?.(toFlow);
    } else {
      bootScene();
    }
    return () => {
      alive = false;
      observer.disconnect();
      built?.destroy();
    };
  });

  let bootScene: (() => void) | null = null;
  function coreOff(why: string) {
    console.warn(`[canvas] core off: ${why}`);
    coreOn = false;
    coreDrawn = new Set();
    bootScene?.();
  }

  function fitView(boxes: Box[]): Viewport {
    const b = boundsOf(boxes)!;
    const s = screenSize();
    const zoom = Math.max(MIN_ZOOM, Math.min(READABLE_ZOOM, MAX_ZOOM, Math.min(s.width / (b.width * (1 + FIT_PADDING)), s.height / (b.height * (1 + FIT_PADDING)))));
    return { zoom, x: s.width / 2 - (b.x + b.width / 2) * zoom, y: s.height / 2 - (b.y + b.height / 2) * zoom };
  }

  const domTiles = $derived(placed.filter((t) => domIds.has(t.id)));
</script>

<svelte:window onkeydown={onKeydown} onblur={() => (altHeld = false)} onkeyup={(e) => {
  altHeld = e.altKey;
  if (e.key === ' ') {
    space = false;
  }
}} onpointerup={(e) => active && !surface?.contains(e.target as Node) && onUp(e)} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wrap svelte-flow" onfocusin={trackFocus} bind:this={wrap} ondragover={onDragOver} ondrop={spec.chrome ? onDrop : undefined} data-canvas-surface data-renderer={scene?.backend ?? (coreOn ? CORE : 'pending')} data-revealed={revealed} data-view={`${view.x},${view.y},${view.zoom}`}>
  <div
    class="surface svelte-flow__pane"
    bind:this={surface}
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
    onwheel={onWheel}
    onpointerenter={measureSurface}
    onclick={onClickInside}
    ondblclick={onDouble}
    oncontextmenu={onContextMenu}
    onpointerleave={() => props.onPointer?.(null)}
    class:panning={space}
    data-owns-pinch
  >
    {#if coreOn}
      <CoreFrames frames={coreFrames} edited={resizing} cards={nodeCards} posters={posterCards} overlay={coreOverlay} look={coreLook ?? undefined} {view} {area} sourceUrl={coreSource} onready={(ids) => (coreDrawn = ids)} onfallback={coreOff} />
    {/if}
    <div class="svelte-flow__viewport gpu-nodes" style={`transform: translate(${view.x}px, ${view.y}px) scale(${view.zoom})`}>
      <svg class="gpu-edges" class:core={coreOn} aria-hidden="true">
        {#each curves as c (c.edge.id)}
          <g class="svelte-flow__edge" class:selected={c.edge.id === selectedEdge} class:iterate={(c.edge.mode ?? 'fixed') === 'iterate'} class:linked={selected.includes(c.edge.source) || selected.includes(c.edge.target)} data-id={c.edge.id} data-source={c.edge.source} data-target={c.edge.target}>
            <path class="svelte-flow__edge-path" d={`M${c.curve.from.x},${c.curve.from.y} C${c.curve.c1.x},${c.curve.c1.y} ${c.curve.c2.x},${c.curve.c2.y} ${c.curve.to.x},${c.curve.to.y}`} />
            {#if (c.edge.mode ?? 'fixed') === 'iterate'}
              <g class="wire-iterate-badge" data-testid="wire-iterate-icon" transform={`translate(${c.curve.mid.x} ${c.curve.mid.y})`}>
                <circle r="11" />
                <Repeat x={-7} y={-7} width={14} height={14} />
              </g>
            {/if}
          </g>
        {/each}
      </svg>
      {#each [...copies] as [id, c] (id)}
        <div class="gpu-copy-ghost" data-testid="gpu-copy-ghost" style={`transform: translate(${c.x}px, ${c.y}px);width:${c.w}px;height:${c.h}px`}></div>
      {/each}
      {#each placed as t (t.id)}
        {@const on = selected.includes(t.id)}
        <div
          class="svelte-flow__node gpu-node"
          class:selected={on}
          class:has-dom={domIds.has(t.id)}
          role="button"
          tabindex="-1"
          aria-label={t.displayName || t.kind || 'node'}
          aria-pressed={on}
          data-testid="gpu-node"
          data-id={t.id}
          data-kind={t.kind}
          data-core={coreDrawn.has(t.id) || undefined}
          data-box={`${t.x},${t.y},${t.w},${t.h}`}
          style={`transform: translate(${t.x}px, ${t.y}px);width:${t.w}px;height:${t.h}px${t.rotation ? `;rotate:${t.rotation}deg;transform-origin:${t.w / 2}px ${t.h / 2}px` : ''}`}
        >
          <GpuTileChrome tile={t} selected={on} painted={coreDrawn.has(t.id)} full={chromeIds.has(t.id)} resizable={resizable && on} onrotate={props.onRotate} knobDrawn={coreRotate.some((r) => r.id === t.id)} />
          {@render props.tileOver?.({ id: t.id })}
          {#if !domIds.has(t.id) && t.kind === 'motion'}
            {@const kind = String(summaries.get(t.id)?.data.kind ?? 'frame')}
            <div class="frame-standin" data-testid="motion-node" data-motion-node={t.id} data-kind={kind} data-mode="gpu" style={`--bar-h:${kind === 'frame' ? MOTION_NODE_BAR_H : 0}px`}>
              <div class="frame-standin-stage" data-testid="motion-node-stage" data-frame-stage data-drawn={drawn.has(t.id) || coreDrawn.has(t.id)}>
                {#if t.poster}
                  <div class="frame-standin-poster" data-testid="motion-node-poster"></div>
                {/if}
              </div>
            </div>
          {/if}
          {#if domIds.has(t.id)}
            <div class="gpu-dom-node" class:unshown={!handedOver(t)} data-testid="gpu-dom-node" data-id={t.id}>
              <NodeBoundary>
                {@render props.tile({ id: t.id, selected: on })}
              </NodeBoundary>
            </div>
          {/if}
        </div>
      {/each}
      <PeerLayer peers={corePeers.length ? (props.peers ?? []).filter((p) => p.chat) : (props.peers ?? [])} outlined={!corePeers.length} rectOf={(id) => byId.get(id) ?? null} zoom={view.zoom} />
      {#if measured.length || snapGuides.length || snapSpacing.length}
        <MeasureLayer gaps={[...measured, ...snapSpacing]} guides={coreOn ? [] : snapGuides} zoom={view.zoom} />
      {/if}
    </div>
  </div>


  <div class="snapshot-shelf" aria-hidden="true" bind:this={shelfHost}>
    {#if shotMount && byId.get(shotMount)}
      {@const t = byId.get(shotMount)!}
      {#key shotMount}
        <div class="snapshot-node" data-snapshot={t.id} style={`width:${t.w}px;height:${t.h}px`}>
          <NodeBoundary>
            {@render props.tile({ id: t.id, selected: false })}
          </NodeBoundary>
        </div>
      {/key}
    {/if}
  </div>

  <div class="poster-shelf" aria-hidden="true">
    {#each placed.filter((t) => shelf.has(t.id)) as t (t.id)}
      <div class="shelf-node" data-shelf={t.id} style={`width:${t.w}px;height:${t.h}px`}>
        <NodeBoundary>
          {@render props.tile({ id: t.id, selected: false })}
        </NodeBoundary>
      </div>
    {/each}
  </div>

  {#if failed}
    <p class="edge-refusal" role="alert">GPU renderer unavailable: {failed}</p>
  {/if}

  <PageZoomLock zoom={pageZoom} />

  {#if dev}
    <RendererBadge renderer={scene?.backend ?? (coreOn ? CORE : 'starting')} reason={lossNote} />
  {/if}

  {#if refusal}
    <p class="edge-refusal" role="status">{refusal}</p>
  {/if}

  {#if targeting}
    <p class="edge-refusal" role="status">Pick the node to connect to — Esc to cancel</p>
  {/if}

  {#if props.onDraw && (scene || coreOn) && props.barContext === BarContext.Canvas && frameBar.tool !== DrawTool.Select}
    <CanvasDrawLayer
      tool={frameBar.tool}
      {toFlow}
      ondraw={async (drawn) => {
        await props.onDraw?.(drawn);
        frameBar.tool = DrawTool.Select;
      }}
      onframe={async (target) => {
        await props.onDrawFrame?.(target);
        frameBar.tool = DrawTool.Select;
      }}
    />
  {/if}

  {#if spec.chrome && props.onCreate}
    <CanvasAddBar
      onpick={addAtCentre}
      onupload={props.onUpload}
      ontemplate={props.onTemplate ? (id) => props.onTemplate?.(id, viewCentre()) : undefined}
      onframes={props.onFrameTemplates ? () => props.onFrameTemplates?.(viewCentre()) : undefined}
      context={props.barContext}
      zoom={view.zoom}
    />
  {/if}

  {#if spec.chrome}
    <SelectionToolbar
      box={gesturing ? null : selection.box}
      zoom={selection.zoom}
      count={selected.length}
      nodeSummaries={selectedSummaries}
      edges={selectionEdges}
      stale={props.stale ?? []}
      choicesFor={props.modelChoicesFor}
      catalogueSynced={selectionMedium && props.catalogueSyncedFor ? props.catalogueSyncedFor(selectionMedium) : true}
      runQuote={props.runQuoteFor?.(selected) ?? null}
      onrun={() => props.onRunNode?.(selected[0])}
      onaction={runSelectionAction}
      onpropertychange={(patch) => props.onPropertyChange?.(selected, patch)}
    />
    {#if props.postAction}
      <NextStepChips postAction={props.postAction} box={selection.box} zoom={selection.zoom} nodeId={selected.length === 1 ? selected[0] : null} onpick={pickNextStep} />
    {/if}
  {/if}

  {#if menuAt && spec.chrome}
    <CanvasContextMenu at={menuAt} summaries={selectedSummaries} available={canvasMenuIds(selected.length)} layers={menuLayers} onpick={runSelectionAction} onlayer={(id) => select([id])} onclose={() => (menuAt = null)} />
  {/if}

  {#if connectPickerAt}
    <ConnectPicker at={connectPickerAt} onpick={pickConnectMedium} onclose={() => (connectPickerAt = null)} />
  {/if}

  {#if picked && (props.onEdgeRetype || props.onEdgeDelete || props.onEdgeModeChange)}
    <EdgePanel
      edge={picked.edge}
      at={picked.screen}
      kinds={props.onEdgeRetype ? pickedKinds : []}
      modes={!!props.onEdgeModeChange}
      deletable={!!props.onEdgeDelete}
      onkind={retype}
      onmode={retypeMode}
      ondelete={() => {
        if (picked) {
          props.onEdgeDelete?.(picked.edge.id);
        }
        picked = null;
      }}
      onclose={() => (picked = null)}
    />
  {/if}
</div>

<style>
  :global(html.canvas-gesture),
  :global(html.canvas-gesture *) {
    user-select: none !important;
    -webkit-user-select: none !important;
  }

  .wrap:not([data-revealed='true']) .surface,
  .wrap:not([data-revealed='true']) :global(canvas[data-testid='gpu-canvas']) {
    visibility: hidden;
  }

  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: clip;
    background: var(--ui-canvas);
  }

  .surface {
    position: absolute;
    inset: 0;
    touch-action: none;
    user-select: none;
  }

  .surface.panning {
    cursor: grab;
  }

  .surface :global(canvas[data-testid='gpu-canvas']) {
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .gpu-nodes {
    position: absolute;
    z-index: 1;
    left: 0;
    top: 0;
  }

  .gpu-node {
    left: 0;
    top: 0;
  }

  .gpu-copy-ghost {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    border: 1.5px dashed var(--ui-accent, #0a84ff);
    background: color-mix(in srgb, var(--ui-accent, #0a84ff) 8%, transparent);
  }

  .gpu-node :global(.svelte-flow__handle.typed-port) {
    pointer-events: all;
    cursor: crosshair;
  }

  .gpu-edges {
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: 1px;
    overflow: visible;
    pointer-events: none;
  }

  .gpu-edges path {
    fill: none;
    stroke: color-mix(in srgb, var(--ink-soft, #6e6e73) 45%, var(--paper, #fff));
    stroke-width: 1;
  }

  .gpu-edges .linked path,
  .gpu-edges .selected path {
    stroke: var(--ink-soft, #6e6e73);
  }

  .gpu-edges .iterate path {
    stroke: var(--ui-wire-iterate);
    stroke-dasharray: 6 4;
  }

  .gpu-edges.core {
    visibility: hidden;
  }

  .wire-iterate-badge circle {
    fill: var(--ui-panel-raised);
    stroke: var(--ui-wire-iterate);
    stroke-width: 1.5;
  }

  .wire-iterate-badge :global(svg) {
    color: var(--ui-wire-iterate);
  }

  .snapshot-shelf {
    position: fixed;
    left: 0;
    top: 0;
    opacity: 0;
    z-index: -1;
    pointer-events: none;
    background: var(--ui-canvas);
  }

  .snapshot-node {
    position: relative;
  }

  .poster-shelf {
    position: fixed;
    left: 0;
    top: 0;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }

  .shelf-node {
    position: absolute;
    left: 0;
    top: 0;
  }

  .frame-standin {
    position: absolute;
    inset: 0;
  }

  .gpu-dom-node.unshown :global([data-motion-node]) {
    opacity: 0;
  }

  .frame-standin-stage {
    position: absolute;
    inset: 0 0 var(--bar-h) 0;
  }

  .frame-standin-poster {
    position: absolute;
    inset: 0;
  }

  .gpu-dom-node {
    position: absolute;
    inset: 0;
    content-visibility: auto;
    user-select: text;
  }

  .frame-standin {
    position: absolute;
    inset: 0;
  }

  .frame-standin-stage {
    position: absolute;
    inset: 0 0 var(--bar-h) 0;
  }

  .frame-standin-poster {
    position: absolute;
    inset: 0;
  }

  .gpu-dom-node {
    position: absolute;
    inset: 0;
    content-visibility: auto;
    user-select: text;
  }


  .edge-refusal {
    position: absolute;
    z-index: 12;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 5px 12px;
    font-size: 12px;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 999px;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.1);
    pointer-events: none;
  }
</style>
