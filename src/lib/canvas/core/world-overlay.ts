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

let fixedFor: Fixed | null = null;
let fixedItems: PathItem[] = [];
let fixedParts: PathItem[][] = [];
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

function zoomFree(o: Fixed): PathItem[] {
  if (fixedFor && FIXED_KEYS.every((k) => fixedFor![k] === o[k])) {
    return fixedItems;
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
  const parts = [
    ...o.curves.map((c) => {
      const look = edgeLook(c.edge, o.selected, o.selectedEdge);
      return once(`wire:${c.edge.id}`, { look, curve: c.curve }, () => edgeItems(c.edge.id, c.curve, look, o.theme));
    }),
    ...o.chrome.flatMap((t) => [
      once(`chrome:${t.id}`, tileFields(t), () => turnedBy(layersOf(t).tile(t, o.glyphs), t.turn)),
      drawsState(t) ? once(`state:${t.id}`, t, () => turnedBy(stateChrome(t, o.glyphs), t.turn)) : NO_ITEMS
    ])
  ];
  built = next;
  if (parts.length !== fixedParts.length || parts.some((p, i) => p !== fixedParts[i])) {
    fixedParts = parts;
    fixedItems = parts.flat();
  }
  return fixedItems;
}

export type CoreOverlay = { fixed: readonly PathItem[]; live: readonly PathItem[] };

export const NO_OVERLAY: CoreOverlay = { fixed: [], live: [] };

export function overlayOf(o: WorldOverlay): CoreOverlay {
  return { fixed: zoomFree(o), live: liveItems(o) };
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
