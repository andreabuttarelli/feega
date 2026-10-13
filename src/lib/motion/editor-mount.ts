import type { MotionDoc } from './doc';

export enum Mount {
  Page = 'page',
  Canvas = 'canvas'
}

type MountRules = { ownsTitle: boolean; closes: boolean };

export const MOUNT: Record<Mount, MountRules> = {
  [Mount.Page]: { ownsTitle: true, closes: false },
  [Mount.Canvas]: { ownsTitle: false, closes: true }
};

const STILL_FRAMES = 1;

export const timelineFits = (doc: Pick<MotionDoc, 'durationInFrames'>) => doc.durationInFrames > STILL_FRAMES;
