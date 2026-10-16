import type { Gesture } from '$lib/motion/drill';

export type FramePoint = { x: number; y: number };
export type DrillAsk = { at: FramePoint; gesture: Gesture };

const FRESH_MS = 3000;

export function drillRequests(now: () => number) {
  let pending: (DrillAsk & { nodeId: string; when: number }) | null = null;
  return {
    request(nodeId: string, at: FramePoint, gesture: Gesture) {
      pending = { nodeId, at, gesture, when: now() };
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
      return now() - ask.when > FRESH_MS ? null : { at: ask.at, gesture: ask.gesture };
    }
  };
}

export const frameDrill = drillRequests(() => Date.now());
