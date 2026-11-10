import type { Viewport } from '$lib/canvas/dot-grid';
import { restoreViewport } from '$lib/canvas/restore-viewport';
import { baseNodeId } from '$lib/canvas/breakpoint-views';
import { frameSourceUrl, framesOnCanvas, type FrameTile } from './frame-source';
import { fillOrder } from './placeholders';
import { nodeSize } from '$lib/canvas/node-size';

type Row = { id: string; type: string; position: { x: number; y: number }; size: { width: number | null; height: number | null }; data: Record<string, unknown> };
type Place = { projectId: string; canvasId: string; orgId?: string };
type Screen = { width: number; height: number };

export const coreSourcePath = (place: Place, id: string) => `/p/${place.projectId}/c/${place.canvasId}/motion/${baseNodeId(id)}/source`;

const tileOf = (r: Row): FrameTile[] => {
  const placed = nodeSize(r.type, r.data);
  const w = r.size.width ?? placed.w;
  const h = r.size.height ?? placed.h;
  return w && h ? [{ id: r.id, kind: r.type, x: r.position.x, y: r.position.y, w, h }] : [];
};

function boundsOf(tiles: FrameTile[]) {
  if (!tiles.length) {
    return null;
  }
  const x = Math.min(...tiles.map((t) => t.x));
  const y = Math.min(...tiles.map((t) => t.y));
  return { x, y, width: Math.max(...tiles.map((t) => t.x + t.w)) - x, height: Math.max(...tiles.map((t) => t.y + t.h)) - y };
}

export function earlySourceUrls(rows: readonly Row[], place: Place, saved: Viewport | null, screen: Screen): string[] {
  const tiles = rows.flatMap(tileOf);
  const data = new Map(rows.map((r) => [r.id, r.data]));
  const view = restoreViewport(saved, boundsOf(tiles), screen);
  const frames = framesOnCanvas(tiles, (id) => data.get(id) ?? {});
  return fillOrder(frames, view, screen).map((f) => frameSourceUrl((id) => coreSourcePath(place, id), f, place.orgId));
}
