import { mul2d } from '@feega/motion-core/motion/affine';
import type { PathItem } from '@feega/motion-core/motion/gpu-full/display-list';
import type { Box, Curve } from '$lib/canvas/gpu/geometry';
import type { SnapGuide } from '$lib/canvas/snap';
import { EdgeLook, edgeItems, ghostItems, guideItems, marqueeItems, runningItems, peerItems, type CorePeer, type CoreTheme } from './overlay';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import { ports, stateChrome, tileChrome, type Glyphs, type StateTile } from './chrome';
import { turned, type Turn } from './screen-uses';
import { line, rect, solid } from './shapes';

const ITERATE = 'iterate';
const PEER_OUTLINE_PX = 2;
const PEER_OUTLINE = 'peer-outline';

export type PeerOutline = { key: string; box: Box; color: string };

export type Wire = { id: string; source: string; target: string; mode?: string };

export type WorldOverlay = { curves: readonly { edge: Wire; curve: Curve }[]; selected: readonly string[]; selectedEdge: string | null; marquee: Box | null; guides: readonly SnapGuide[]; zoom: number; theme: CoreTheme; glyphs: Glyphs; peers: readonly CorePeer[]; outlines: readonly PeerOutline[]; ghost: { curve: Curve; ok: boolean } | null; running: readonly (Box & { id: string })[]; chrome: readonly ChromeOnCanvas[] };

export enum ChromeLayers {
  State = 'state',
  Whole = 'whole',
  Ports = 'ports'
}

export type ChromeOnCanvas = StateTile & { turn?: Turn; layers?: ChromeLayers };

const CHROME_OF: Record<ChromeLayers, { tile: (t: ChromeOnCanvas, glyphs: Glyphs) => PathItem[]; state: boolean }> = {
  [ChromeLayers.State]: { tile: () => [], state: true },
  [ChromeLayers.Ports]: { tile: (t) => ports(t), state: false },
  [ChromeLayers.Whole]: { tile: (t, glyphs) => tileChrome(t, glyphs), state: true }
};

const layersOf = (t: ChromeOnCanvas) => CHROME_OF[t.layers ?? ChromeLayers.State];

const tileFields = ({ ring: _ring, handles: _handles, ringColor: _ringColor, names: _names, strokeZoom: _strokeZoom, ...tile }: ChromeOnCanvas) => tile;

const drawsState = (t: ChromeOnCanvas) => layersOf(t).state && (t.ring !== NodeChrome.None || t.handles || t.names);

export function edgeLook(edge: Wire, selected: readonly string[], selectedEdge: string | null): EdgeLook {
  if (edge.mode === ITERATE) {
    return EdgeLook.Iterate;
  }
  const linked = edge.id === selectedEdge || selected.includes(edge.source) || selected.includes(edge.target);
  return linked ? EdgeLook.Linked : EdgeLook.Plain;
}

const turnedBy = (items: PathItem[], turn: Turn | undefined): PathItem[] => (turn ? items.map((i) => ({ ...i, matrix: mul2d(turned(turn), i.matrix) })) : items);

type Fixed = Pick<WorldOverlay, 'curves' | 'chrome' | 'selected' | 'selectedEdge' | 'theme' | 'glyphs'>;
const FIXED_KEYS = ['curves', 'chrome', 'selected', 'selectedEdge', 'theme', 'glyphs'] as const;

type Settled = { fixed: PathItem[]; selected: PathItem[] };

let fixedFor: Fixed | null = null;
let settled: Settled = { fixed: [], selected: [] };
let settledParts: Record<keyof Settled, PathItem[][]> = { fixed: [], selected: [] };
const NO_ITEMS: PathItem[] = [];
let built = new Map<string, Built>();

type Built = { from: Record<string, unknown>; items: PathItem[] };

function alike(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  return sameFields(a as Record<string, unknown>, b as Record<string, unknown>);
}
function sameFields(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => alike(a[k], b[k]));
}

const flatOnChange = (parts: PathItem[][], was: PathItem[][], items: PathItem[]) => (parts.length === was.length && parts.every((p, i) => p === was[i]) ? items : parts.flat());

function zoomFree(o: Fixed): Settled {
  if (fixedFor && FIXED_KEYS.every((k) => fixedFor![k] === o[k])) {
    return settled;
  }
  const kept = fixedFor?.theme === o.theme && fixedFor.glyphs === o.glyphs ? built : new Map<string, Built>();
  const next = new Map<string, Built>();
  const once = (key: string, from: Record<string, unknown>, make: () => PathItem[]) => {
    const old = kept.get(key);
    const items = old && sameFields(old.from, from) ? old.items : make();
    next.set(key, { from, items });
    return items;
  };
  fixedFor = o;
  const picked = new Set(o.selected);
  const parts: Record<keyof Settled, PathItem[][]> = { fixed: [], selected: [] };
  for (const c of o.curves) {
    const look = edgeLook(c.edge, o.selected, o.selectedEdge);
    const moving = picked.has(c.edge.source) || picked.has(c.edge.target);
    parts[moving ? 'selected' : 'fixed'].push(once(`wire:${c.edge.id}`, { look, curve: c.curve }, () => edgeItems(c.edge.id, c.curve, look, o.theme)));
  }
  for (const t of o.chrome) {
    const into = parts[picked.has(t.id) ? 'selected' : 'fixed'];
    into.push(once(`chrome:${t.id}`, tileFields(t), () => turnedBy(layersOf(t).tile(t, o.glyphs), t.turn)));
    into.push(drawsState(t) ? once(`state:${t.id}`, t, () => turnedBy(stateChrome(t, o.glyphs), t.turn)) : NO_ITEMS);
  }
  built = next;
  settled = { fixed: flatOnChange(parts.fixed, settledParts.fixed, settled.fixed), selected: flatOnChange(parts.selected, settledParts.selected, settled.selected) };
  settledParts = parts;
  return settled;
}

export type CoreOverlay = { fixed: readonly PathItem[]; selected: readonly PathItem[]; live: readonly PathItem[] };

export const NO_OVERLAY: CoreOverlay = { fixed: [], selected: [], live: [] };

export function overlayOf(o: WorldOverlay): CoreOverlay {
  return { ...zoomFree(o), live: liveItems(o) };
}

function liveItems(o: WorldOverlay): PathItem[] {
  return [
    ...o.running.flatMap((b) => runningItems(b, o.zoom, o.theme)),
    ...(o.marquee ? marqueeItems(o.marquee, o.zoom, o.theme) : []),
    ...guideItems(o.guides, o.zoom, o.theme),
    ...o.outlines.map((p) => solid(`${p.key}:${PEER_OUTLINE}`, line(rect(p.box.x, p.box.y, p.box.w, p.box.h), PEER_OUTLINE_PX / o.zoom, true), p.color)),
    ...o.peers.flatMap((p) => peerItems(p, o.zoom, o.glyphs)),
    ...(o.ghost ? ghostItems(o.ghost.curve, o.ghost.ok, o.zoom, o.theme) : [])
  ];
}
