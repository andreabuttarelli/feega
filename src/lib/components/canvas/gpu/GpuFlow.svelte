<script lang="ts">
  import { onMount, untrack, type ComponentProps } from 'svelte';
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
  import { MOTION_NODE_BAR_H } from '$lib/canvas/motion-node';
  import { BarContext } from '$lib/canvas/bottom-bar';
  import { frameBar } from '$lib/canvas/frame-bar.svelte';
  import { DrawTool } from '$lib/motion/draw-tool';
  import { CANVAS_MODES, CanvasMode } from '$lib/canvas/canvas-mode';
  import { FIT_PADDING, READABLE_ZOOM } from '$lib/canvas/placement';
  import { FocusMode, frameIn, type Insets } from '$lib/canvas/free-area';
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
  import type { SelectionActionId } from '$lib/canvas/selection-actions';
  import type { GenPropertyType } from '$lib/canvas/common-properties';
  import type { GenMedium } from '$lib/canvas/gen-node';
  import type { CanvasEdgeKind, FlowEdge, WireMode } from '$lib/canvas-edges';
  import { setTileRender } from '$lib/canvas/tile-render-context';
  import { setTileResize } from '$lib/canvas/tile-resize-context';
  import { setTileRotate } from '$lib/canvas/tile-rotate-context';
  import type { Viewport } from '$lib/canvas/dot-grid';
  import { panBy, toWorld, visibleIds, zoomAt, type Point } from '$lib/canvas/gpu/camera';
  import { PortSide, edgeAt, portAt, portsOf, resizeCornerAt, wireCurve, type Box, type Corner, type Port } from '$lib/canvas/gpu/geometry';
  import { GestureKind, HitKind, Pointer, clicked, gestureFor, marqueeBox, marqueePick, movedBy, resized, type Hit } from '$lib/canvas/gpu/gesture';
  import { faceOf } from '$lib/canvas/gpu/card-face';
  import { GpuScene, themeOf, type Card, type Wire } from '$lib/canvas/gpu/scene';
  import { backendOf } from '$lib/canvas/gpu/renderer-flag';
  import { recordFrame } from '$lib/canvas/gpu/frame-stats';
  import { parkStuck, shelfIds } from '$lib/canvas/gpu/poster-shelf';
  import { domPainted } from '$lib/canvas/gpu/paint';
  import { NameTag } from '$lib/canvas/node-label';
  import { followGroup } from '$lib/canvas/node-layout';

  let props: ComponentProps<typeof CanvasFlow> & { thumbsOf?: (id: string) => string[]; onfail?: (why: string) => void } = $props();

  const DOM_CAP = 6;
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

  let wrap = $state<HTMLDivElement | null>(null);
  let surface = $state<HTMLDivElement | null>(null);
  let scene = $state<GpuScene | null>(null);
  let failed = $state<string | null>(null);
  let view = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
  let area = $state({ width: 0, height: 0 });
  let selected = $state<string[]>([]);
  let selectedEdge = $state<string | null>(null);
  let hovered = $state<string | null>(null);
  let overrides = $state<Map<string, Box>>(new Map());
  let marquee = $state<Box | null>(null);
  let ghost = $state<{ from: Port; at: Point; ok: boolean } | null>(null);
  let refusal = $state<string | null>(null);
  let menuAt = $state<Point | null>(null);
  let picked = $state<{ edge: FlowEdge; screen: Point } | null>(null);
  let connectPickerAt = $state<Point | null>(null);
  let targeting = $state<string[] | null>(null);
  let space = $state(false);
  let gesturing = $state(false);
  let fitted = false;
  let known = new Set<string>();

  const assetBase = $derived(`/p/${page.params.projectId}/c/${page.params.canvasId}/assets/`);
  const assetUrl = (id: string) => `${assetBase}${id}`;

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
  let parked = $state(new Map<string, number>());
  let shelfClock = $state(0);
  const shelf = $derived(new Set(shelfIds(props.nodeSummaries ?? [], editIds, parked, shelfClock)));
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
  const domIds = $derived(new Set([...editIds, ...sticky.keys(), ...shelf, ...domPainted(placed, (id) => summaries.get(id)?.data ?? {}, view, area)]));

  function portFor(nodeId: string, side: PortSide, handle: string | null | undefined): Port | null {
    const own = ports.filter((p) => p.nodeId === nodeId && p.side === side);
    return own.find((p) => p.handle === (handle ?? null)) ?? own[0] ?? null;
  }

  const curves = $derived(
    edges.flatMap((e) => {
      const from = portFor(e.source, PortSide.Out, e.sourceHandle);
      const to = portFor(e.target, PortSide.In, e.targetHandle);
      return from && to ? [{ edge: e, curve: wireCurve(from, to) }] : [];
    })
  );

  const cards = $derived(
    placed.map(
      (t): Card => ({
        id: t.id,
        x: t.x,
        y: t.y,
        w: t.w,
        h: t.h,
        rotation: t.rotation ?? 0,
        face: faceOf(t, summaries.get(t.id)?.data ?? {}, assetUrl, props.thumbsOf?.(t.id) ?? []),
        hidden: domIds.has(t.id)
      })
    )
  );

  const wires = $derived(
    curves.map(
      (c): Wire => ({
        id: c.edge.id,
        curve: c.curve,
        iterate: (c.edge.mode ?? 'fixed') === 'iterate',
        selected: c.edge.id === selectedEdge || selected.includes(c.edge.source) || selected.includes(c.edge.target)
      })
    )
  );

  const selectedBoxes = $derived(selected.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : [])));
  const resizable = $derived(selectedBoxes.length === 1 && selectedBoxes[0].minW != null && selectedBoxes[0].minH != null && spec.flow.nodesDraggable);

  const editing = $derived(props.barContext === BarContext.Frame);

  $effect(() => {
    scene?.setCards(cards);
  });

  $effect(() => {
    const css = wrap ? getComputedStyle(wrap) : null;
    const level = (name: string) => Number(css?.getPropertyValue(name) || 1);
    scene?.setDim(editing ? { body: level('--neighbour-body'), edges: level('--neighbour-edges') } : null);
  });

  $effect(() => {
    scene?.setWires(wires);
  });

  $effect(() => {
    const ghostCurve = ghost ? (ghost.from.side === PortSide.Out ? wireCurve(ghost.from, ghost.at) : wireCurve(ghost.at, ghost.from)) : null;
    scene?.setOverlay({
      selected: selectedBoxes,
      resizable,
      marquee,
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
    if (!fitted && scene && incoming.length) {
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

  function screenSize() {
    const r = surface?.getBoundingClientRect();
    return { width: r?.width ?? innerWidth, height: r?.height ?? innerHeight, left: r?.left ?? 0, top: r?.top ?? 0 };
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

  function topNodeAt(w: Point): string | null {
    for (let i = placed.length - 1; i >= 0; i--) {
      const t = placed[i];
      const top = t.tag === NameTag.Hidden ? t.y : t.y - LABEL_CLEARANCE;
      if (w.x >= t.x && w.y >= top && w.x <= t.x + t.w && w.y <= t.y + t.h) {
        return t.id;
      }
    }
    return null;
  }

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

  const pointerOf = (e: PointerEvent) => (e.pointerType === 'touch' ? Pointer.Touch : e.pointerType === 'pen' ? Pointer.Pen : Pointer.Mouse);

  function onDown(e: PointerEvent) {
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
      [GestureKind.Pan]: () => ({ kind: GestureKind.Pan, last: local(e), moved: false }),
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
    const p = local(e);
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, p);
      if (pinch && touches.size === 2) {
        const next = pinchOf();
        view = panBy(zoomAt(view, next.mid, next.dist / pinch.dist), { x: next.mid.x - pinch.mid.x, y: next.mid.y - pinch.mid.y });
        pinch = next;
        return;
      }
    }
    const w = toWorld(view, p);
    if (!active) {
      hovered = e.pointerType === 'mouse' ? topNodeAt(w) : null;
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
        view = panBy(view, { x: p.x - a.last.x, y: p.y - a.last.y });
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
        const next = new Map(overrides);
        const moved = movedBy(a.origins, { x: w.x - a.start.x, y: w.y - a.start.y });
        const all = new Map(tiles.map((t) => [t.id, { x: t.x, y: t.y }]));
        const follow = moved.flatMap((m) => followGroup(all, m.id, m, byId.get(m.id)?.members ?? []));
        for (const m of [...moved, ...follow]) {
          const t = byId.get(m.id);
          if (t) {
            next.set(m.id, { x: m.x, y: m.y, w: t.w, h: t.h });
          }
        }
        overrides = next;
        props.onTileDragOver?.([...a.origins.keys()], pointOf(e));
      },
      [GestureKind.Resize]: (a) => {
        if (a.kind !== GestureKind.Resize) {
          return;
        }
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

  function onUp(e: PointerEvent) {
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
    if (!a) {
      return;
    }
    const w = toWorld(view, local(e));
    const END: Record<GestureKind, () => void> = {
      [GestureKind.Pan]: () => {
        if (a.kind === GestureKind.Pan && !a.moved && e.button === 0) {
          clearSelection();
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
    marquee = null;
    ghost = null;
    refusal = null;
    settleOverrides();
  }

  function settleOverrides() {
    overrides = new Map();
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
    if (props.onTileDrop?.(ids, pointOf(e)) === DropVerdict.Taken) {
      settleOverrides();
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

  function openMenu(id: string, at: Point) {
    if (!selected.includes(id)) {
      select([id]);
    }
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
    tool: (c) => {
      if (c.id === 'tool') {
        frameBar.tool = c.tool;
      }
    },
    delete: () => (selected.length || selectedEdge) && dropSelection(selected, selectedEdge ? [selectedEdge] : []),
    deselect: () => clearSelection(),
    'select-all': () => select(placed.map((t) => t.id)),
    fit: () => fitTo(placed),
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

  const SELECTION_RUN: Record<SelectionActionId, (ids: string[]) => void> = {
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
    delete: (ids) => props.onDelete?.(ids)
  };

  function runSelectionAction(id: SelectionActionId) {
    if (selected.length) {
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

  function onDragOver(e: DragEvent) {
    const types = e.dataTransfer?.types ?? [];
    if (![CANVAS_DRAG_FILLED_NODE, CANVAS_DRAG_MEDIUM, CANVAS_DRAG_OUTPUT].some((type) => types.includes(type))) {
      return;
    }
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  }

  function onDrop(e: DragEvent) {
    const at = { x: e.clientX, y: e.clientY };
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
      built?.resize();
      area = { width: surface!.clientWidth, height: surface!.clientHeight };
    });
    GpuScene.create(surface!, backendOf(page.url), themeOf(wrap!))
      .then((s) => {
        if (!alive) {
          s.destroy();
          return;
        }
        built = s;
        s.onFrame = recordFrame;
        s.onReady = (shown) => (drawn = shown);
        scene = s;
        props.onFlow?.(toFlow);
        observer.observe(surface!);
        if (tiles.length) {
          fitted = true;
          view = fitView(tiles);
        }
      })
      .catch((err: unknown) => {
        failed = err instanceof Error ? err.message : String(err);
        props.onfail?.(failed);
      });
    return () => {
      alive = false;
      observer.disconnect();
      built?.destroy();
    };
  });

  function fitView(boxes: Box[]): Viewport {
    const b = boundsOf(boxes)!;
    const s = screenSize();
    const zoom = Math.max(MIN_ZOOM, Math.min(READABLE_ZOOM, MAX_ZOOM, Math.min(s.width / (b.width * (1 + FIT_PADDING)), s.height / (b.height * (1 + FIT_PADDING)))));
    return { zoom, x: s.width / 2 - (b.x + b.width / 2) * zoom, y: s.height / 2 - (b.y + b.height / 2) * zoom };
  }

  const domTiles = $derived(placed.filter((t) => domIds.has(t.id)));
</script>

<svelte:window onkeydown={onKeydown} onkeyup={(e) => e.key === ' ' && (space = false)} onpointerup={(e) => active && !surface?.contains(e.target as Node) && onUp(e)} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wrap svelte-flow" bind:this={wrap} ondragover={onDragOver} ondrop={onDrop} data-canvas-surface data-renderer={scene?.backend ?? 'pending'} data-view={`${view.x},${view.y},${view.zoom}`}>
  <div
    class="surface svelte-flow__pane"
    bind:this={surface}
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
    onwheel={onWheel}
    onclick={onClickInside}
    oncontextmenu={onContextMenu}
    class:panning={space}
  >
    <div class="svelte-flow__viewport gpu-nodes" style={`transform: translate(${view.x}px, ${view.y}px) scale(${view.zoom})`}>
      <svg class="gpu-edges" aria-hidden="true">
        {#each curves as c (c.edge.id)}
          <g class="svelte-flow__edge" class:selected={c.edge.id === selectedEdge} data-id={c.edge.id} data-source={c.edge.source} data-target={c.edge.target}>
            <path class="svelte-flow__edge-path" d={`M${c.curve.from.x},${c.curve.from.y} C${c.curve.c1.x},${c.curve.c1.y} ${c.curve.c2.x},${c.curve.c2.y} ${c.curve.to.x},${c.curve.to.y}`} />
            {#if (c.edge.mode ?? 'fixed') === 'iterate'}
              <g data-testid="wire-iterate-icon"></g>
            {/if}
          </g>
        {/each}
      </svg>
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
          data-box={`${t.x},${t.y},${t.w},${t.h}`}
          style={`transform: translate(${t.x}px, ${t.y}px);width:${t.w}px;height:${t.h}px${t.rotation ? `;rotate:${t.rotation}deg;transform-origin:${t.w / 2}px ${t.h / 2}px` : ''}`}
        >
          <GpuTileChrome tile={t} selected={on} onrotate={props.onRotate} />
          {#if !domIds.has(t.id) && t.kind === 'motion'}
            {@const kind = String(summaries.get(t.id)?.data.kind ?? 'frame')}
            <div class="frame-standin" data-testid="motion-node" data-motion-node={t.id} data-kind={kind} data-mode="gpu" style={`--bar-h:${kind === 'frame' ? MOTION_NODE_BAR_H : 0}px`}>
              <div class="frame-standin-stage" data-testid="motion-node-stage" data-frame-stage>
                <div class="frame-standin-drawn" data-drawn={drawn.has(t.id)}></div>
                {#if t.poster}
                  <div class="frame-standin-poster" data-testid="motion-node-poster"></div>
                {/if}
              </div>
            </div>
          {/if}
          {#if domIds.has(t.id)}
            <div class="gpu-dom-node" data-testid="gpu-dom-node" data-id={t.id}>
              <NodeBoundary>
                {@render props.tile({ id: t.id, selected: on })}
              </NodeBoundary>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>


  {#if failed}
    <p class="edge-refusal" role="alert">GPU renderer unavailable: {failed}</p>
  {/if}

  <PageZoomLock zoom={pageZoom} />

  {#if refusal}
    <p class="edge-refusal" role="status">{refusal}</p>
  {/if}

  {#if targeting}
    <p class="edge-refusal" role="status">Pick the node to connect to — Esc to cancel</p>
  {/if}

  {#if props.onDraw && scene && props.barContext === BarContext.Canvas && frameBar.tool !== DrawTool.Select}
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
    {#if props.actionUrl}
      <NextStepChips actionUrl={props.actionUrl} box={selection.box} zoom={selection.zoom} nodeId={selected.length === 1 ? selected[0] : null} onpick={pickNextStep} />
    {/if}
  {/if}

  {#if menuAt && spec.chrome}
    <CanvasContextMenu at={menuAt} summaries={selectedSummaries} onpick={runSelectionAction} onclose={() => (menuAt = null)} />
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
  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
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
    stroke: transparent;
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
