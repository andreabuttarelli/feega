import { mul2d, type Affine } from '$lib/motion/affine';
import type { PathItem } from '$lib/motion/gpu-full/display-list';
import type { Viewport } from '$lib/canvas/dot-grid';
import type { Box, Curve } from '$lib/canvas/gpu/geometry';
import type { SnapGuide } from '$lib/canvas/snap';
import { EdgeLook, edgeItems, ghostItems, guideItems, hoverItems, marqueeItems, runningItems, peerItems, rotateItems, type CorePeer, type CoreTheme } from './overlay';
import { stateChrome, type Glyphs, type StateTile } from './chrome';
import { turned, type Turn } from './screen-uses';
import { line, rect, solid } from './shapes';

const ITERATE = 'iterate';
const PEER_OUTLINE_PX = 2;
const PEER_OUTLINE = 'peer-outline';

export type PeerOutline = { key: string; box: Box; color: string };

export type Wire = { id: string; source: string; target: string; mode?: string };

export type WorldOverlay = { curves: readonly { edge: Wire; curve: Curve }[]; selected: readonly string[]; selectedEdge: string | null; marquee: Box | null; guides: readonly SnapGuide[]; zoom: number; theme: CoreTheme; glyphs: Glyphs; peers: readonly CorePeer[]; outlines: readonly PeerOutline[]; rotate: readonly { id: string; box: Box }[]; ghost: { curve: Curve; ok: boolean } | null; hovered: Box | null; running: readonly (Box & { id: string })[]; chrome: readonly ChromeOnCanvas[] };

export type ChromeOnCanvas = StateTile & { turn?: Turn };

export function edgeLook(edge: Wire, selected: readonly string[], selectedEdge: string | null): EdgeLook {
  if (edge.mode === ITERATE) {
    return EdgeLook.Iterate;
  }
  const linked = edge.id === selectedEdge || selected.includes(edge.source) || selected.includes(edge.target);
  return linked ? EdgeLook.Linked : EdgeLook.Plain;
}

const turnedBy = (items: PathItem[], turn: Turn | undefined): PathItem[] => (turn ? items.map((i) => ({ ...i, matrix: mul2d(turned(turn), i.matrix) })) : items);

export function overlayOf(o: WorldOverlay): PathItem[] {
  return [
    ...o.curves.flatMap((c) => edgeItems(c.edge.id, c.curve, edgeLook(c.edge, o.selected, o.selectedEdge), o.theme)),
    ...o.chrome.flatMap((t) => turnedBy(stateChrome(t, o.glyphs), t.turn)),
    ...o.running.flatMap((b) => runningItems(b, o.zoom, o.theme)),
    ...(o.hovered ? hoverItems(o.hovered, o.zoom, o.theme) : []),
    ...(o.marquee ? marqueeItems(o.marquee, o.zoom, o.theme) : []),
    ...guideItems(o.guides, o.zoom, o.theme),
    ...o.outlines.map((p) => solid(`${p.key}:${PEER_OUTLINE}`, line(rect(p.box.x, p.box.y, p.box.w, p.box.h), PEER_OUTLINE_PX / o.zoom, true), p.color)),
    ...o.peers.flatMap((p) => peerItems(p, o.zoom, o.glyphs)),
    ...o.rotate.flatMap((r) => rotateItems(r.id, r.box, o.theme)),
    ...(o.ghost ? ghostItems(o.ghost.curve, o.ghost.ok, o.zoom, o.theme) : [])
  ];
}

export function throughCamera(items: readonly PathItem[], view: Viewport): PathItem[] {
  const camera: Affine = [view.zoom, 0, 0, view.zoom, view.x, view.y];
  return items.map((i) => ({ ...i, matrix: mul2d(camera, i.matrix) }));
}
