import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { atFirstRevision, frameNodeOf } from './motion-node';
import { PENDING_FRAME_TYPE } from './pending-frame';

const OUTPUT_SIDE = 320;

type Placement = { id: string; canvasId: string; projectId: string; name: string | null; at: { x: number; y: number }; doc: { width: number; height: number } };

export function placedFrame(p: Placement): CanvasNodeRecord {
  const shaped = frameNodeOf(p.doc);
  return {
    id: p.id,
    canvasId: p.canvasId,
    projectId: p.projectId,
    type: 'motion',
    displayName: p.name,
    position: { ...p.at, z: 0 },
    size: { width: shaped.w, height: shaped.h },
    data: atFirstRevision(shaped.data),
    version: 0
  };
}

export function settle<T extends { id: string }>(tiles: T[], id: string, saved: T | null): T[] {
  return saved ? tiles.map((t) => (t.id === id ? saved : t)) : tiles.filter((t) => t.id !== id);
}

export function pendingOutput(id: string, drop: { x: number; y: number }): CanvasNodeRecord {
  return {
    id,
    canvasId: '',
    projectId: '',
    type: PENDING_FRAME_TYPE,
    displayName: null,
    position: { x: drop.x - OUTPUT_SIDE / 2, y: drop.y - OUTPUT_SIDE / 2, z: 0 },
    size: { width: OUTPUT_SIDE, height: OUTPUT_SIDE },
    data: {},
    version: 0
  };
}
