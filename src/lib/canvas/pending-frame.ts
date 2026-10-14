import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { frameNodeOf } from './motion-node';

const PENDING_PREFIX = 'pending-frame:';

export const PENDING_FRAME_TYPE = 'pending_frame';

export const isPendingFrame = (id: string) => id.startsWith(PENDING_PREFIX);

export function pendingFrame(at: { x: number; y: number }, picture: { width: number; height: number }): CanvasNodeRecord {
  const shaped = frameNodeOf(picture);
  return {
    id: `${PENDING_PREFIX}${crypto.randomUUID()}`,
    canvasId: '',
    projectId: '',
    type: PENDING_FRAME_TYPE,
    displayName: null,
    position: { ...at, z: 0 },
    size: { width: shaped.w, height: shaped.h },
    data: shaped.data,
    version: 0
  };
}
