import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { FrameKind, elementNodeOf } from './motion-node';
import { layoutOf } from './node-layout';
import { flowOf } from '$lib/motion/layout/flow';

type Boxed = { id: string; x: number; y: number; w: number; h: number; data: Record<string, unknown>; select?: boolean };

const GROUP_NAME = 'Group';
const STACK_NAME = 'Stack';

function unionOf(tiles: readonly Boxed[]) {
  const left = Math.min(...tiles.map((t) => t.x));
  const top = Math.min(...tiles.map((t) => t.y));
  const right = Math.max(...tiles.map((t) => t.x + t.w));
  const bottom = Math.max(...tiles.map((t) => t.y + t.h));
  return { left, top, width: right - left, height: bottom - top };
}

function containerRecord(id: string, bounds: { left: number; top: number; width: number; height: number }, kind: FrameKind, name: string): CanvasNodeRecord {
  const shaped = elementNodeOf(bounds, kind);
  return {
    id,
    canvasId: '',
    projectId: '',
    type: shaped.type,
    displayName: name,
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
  return [{ ...toTile(containerRecord(groupId, unionOf(picked), FrameKind.Group, GROUP_NAME)), select: true }, ...members];
}

export function wrappedLocally<T extends Boxed>(tiles: T[], ids: readonly string[], stackId: string, toTile: (record: CanvasNodeRecord) => T): T[] {
  const wanted = new Set(ids);
  const picked = tiles.filter((t) => wanted.has(t.id));
  if (!picked.length) {
    return tiles;
  }
  const { box } = flowOf(picked.map((t) => ({ left: t.x, top: t.y, width: t.w, height: t.h })));
  const stack = { ...toTile(containerRecord(stackId, box, FrameKind.Element, STACK_NAME)), select: true };
  return [...tiles.map((t) => (t.select ? { ...t, select: false } : t)), stack];
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
