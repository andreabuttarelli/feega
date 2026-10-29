import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';

export type FrameDocEdit = (doc: MotionDoc) => OpResult;

export type FrameDocsSide = { edit(nodeId: string, change: FrameDocEdit, summary: string): boolean };

let side: FrameDocsSide | null = null;

export const frameDocs = {
  edit(nodeId: string, change: FrameDocEdit, summary: string): boolean {
    return side?.edit(nodeId, change, summary) ?? false;
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
