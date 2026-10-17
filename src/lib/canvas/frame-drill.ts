import { Depth, type Gesture } from '$lib/motion/drill';

export type FramePoint = { x: number; y: number };
export type DrillAsk = { at: FramePoint | null; gesture: Gesture; from: Depth };

const FRESH_MS = 3000;

export function drillRequests(now: () => number) {
  let pending: (DrillAsk & { nodeId: string; when: number }) | null = null;
  return {
    request(nodeId: string, at: FramePoint | null, gesture: Gesture, from: Depth = Depth.Canvas) {
      pending = { nodeId, at, gesture, from, when: now() };
    },
    upgrade(nodeId: string, gesture: Gesture) {
      if (pending?.nodeId === nodeId) {
        pending = { ...pending, gesture };
      }
    },
    take(nodeId: string): DrillAsk | null {
      const ask = pending;
      if (!ask || ask.nodeId !== nodeId) {
        return null;
      }
      pending = null;
      return now() - ask.when > FRESH_MS ? null : { at: ask.at, gesture: ask.gesture, from: ask.from };
    }
  };
}

export const frameDrill = drillRequests(() => Date.now());
