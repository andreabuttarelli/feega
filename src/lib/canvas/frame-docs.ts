import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';

export type FrameDocEdit = (doc: MotionDoc) => OpResult;

export type HeldDoc = { nodeId: string; doc: MotionDoc; like: string };

export type FrameDocsSide = {
  edit(nodeId: string, change: FrameDocEdit, summary: string): boolean;
  doc(nodeId: string): MotionDoc | null;
  hold(held: HeldDoc, saved: Promise<boolean>): void;
};

let side: FrameDocsSide | null = null;

export const frameDocs = {
  edit(nodeId: string, change: FrameDocEdit, summary: string): boolean {
    return side?.edit(nodeId, change, summary) ?? false;
  },
  doc(nodeId: string): MotionDoc | null {
    return side?.doc(nodeId) ?? null;
  },
  hold(held: HeldDoc, saved: Promise<boolean>) {
    side?.hold(held, saved);
  },
  publish(next: FrameDocsSide): () => void {
    side = next;
    return () => {
      if (side === next) {
        side = null;
      }
    };
  }
};
