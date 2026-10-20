import { Depth, type Gesture } from '$lib/motion/drill';

export type FramePoint = { x: number; y: number };
export type HeldPointer = { pointer: number; client: { x: number; y: number } };
export type DrillAsk = { at: FramePoint | null; gesture: Gesture; from: Depth; drag?: HeldPointer };

const FRESH_MS = 3000;

export function drillRequests(now: () => number) {
  let pending: (DrillAsk & { nodeId: string; when: number }) | null = null;
  let taken: (DrillAsk & { nodeId: string; when: number; late: (ask: DrillAsk) => void }) | null = null;
  const open = new Map<string, (ask: DrillAsk) => void>();
  return {
    request(nodeId: string, at: FramePoint | null, gesture: Gesture, from: Depth = Depth.Canvas, drag?: HeldPointer) {
      pending = { nodeId, at, gesture, from, when: now(), ...(drag ? { drag } : {}) };
      open.get(nodeId)?.({ at, gesture, from, ...(drag ? { drag } : {}) });
    },
    release(nodeId: string) {
      if (pending?.nodeId === nodeId) {
        const { drag: _held, ...rest } = pending;
        pending = rest;
      }
    },
    listen(nodeId: string, listener: (ask: DrillAsk) => void): () => void {
      open.set(nodeId, listener);
      return () => {
        if (open.get(nodeId) === listener) {
          open.delete(nodeId);
        }
      };
    },
    upgrade(nodeId: string, gesture: Gesture) {
      if (pending?.nodeId === nodeId) {
        pending = { ...pending, gesture };
        return;
      }
      const late = taken;
      taken = null;
      if (late?.nodeId === nodeId && now() - late.when <= FRESH_MS) {
        late.late({ at: late.at, gesture, from: late.from });
      }
    },
    take(nodeId: string, late: (ask: DrillAsk) => void = () => {}): DrillAsk | null {
      const ask = pending;
      if (!ask || ask.nodeId !== nodeId) {
        return null;
      }
      pending = null;
      if (now() - ask.when > FRESH_MS) {
        return null;
      }
      taken = { ...ask, late };
      return { at: ask.at, gesture: ask.gesture, from: ask.from, ...(ask.drag ? { drag: ask.drag } : {}) };
    }
  };
}

export const frameDrill = drillRequests(() => Date.now());
