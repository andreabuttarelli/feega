import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { FrameKind, elementNodeOf } from './motion-node';
import { layoutOf } from './node-layout';

type Boxed = { id: string; x: number; y: number; w: number; h: number; data: Record<string, unknown>; select?: boolean };

const GROUP_NAME = 'Group';

function unionOf(tiles: readonly Boxed[]) {
  const left = Math.min(...tiles.map((t) => t.x));
  const top = Math.min(...tiles.map((t) => t.y));
  const right = Math.max(...tiles.map((t) => t.x + t.w));
  const bottom = Math.max(...tiles.map((t) => t.y + t.h));
  return { left, top, width: right - left, height: bottom - top };
}

function groupRecord(id: string, picked: readonly Boxed[]): CanvasNodeRecord {
  const bounds = unionOf(picked);
  const shaped = elementNodeOf(bounds, FrameKind.Group);
  return {
    id,
    canvasId: '',
    projectId: '',
    type: 'motion',
    displayName: GROUP_NAME,
    position: { x: bounds.left, y: bounds.top, z: 0 },
    size: { width: shaped.w, height: shaped.h },
    data: shaped.data,
    version: 0
  };
}

export function groupedLocally<T extends Boxed>(tiles: T[], ids: readonly string[], groupId: string, toTile: (record: CanvasNodeRecord) => T): T[] {
  const wanted = new Set(ids);
  const picked = tiles.filter((t) => wanted.has(t.id));
  if (picked.length < 2) {
    return tiles;
  }

  const members = tiles.map((t) => (wanted.has(t.id) ? { ...t, select: false, data: { ...t.data, groupId } } : t));
  return [{ ...toTile(groupRecord(groupId, picked)), select: true }, ...members];
}

export function ungroupedLocally<T extends Boxed>(tiles: T[], groupId: string): T[] {
  return tiles.map((t) => (layoutOf(t.data).groupId === groupId ? { ...t, select: true, data: { ...t.data, groupId: null } } : t));
}

export function inOrder() {
  let tail: Promise<unknown> = Promise.resolve();
  return <R>(op: () => Promise<R>): Promise<R> => {
    const run = tail.then(op);
    tail = run.catch(() => undefined);
    return run;
  };
}
