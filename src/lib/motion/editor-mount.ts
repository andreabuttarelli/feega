import type { MotionDoc } from './doc';

export enum Mount {
  Page = 'page',
  Canvas = 'canvas'
}

export enum Stage {
  Own = 'own',
  Node = 'node'
}

export enum Zoom {
  Stage = 'stage',
  Canvas = 'canvas'
}

type MountRules = { ownsTitle: boolean; closes: boolean; stage: Stage; zoom: Zoom };

export const MOUNT: Record<Mount, MountRules> = {
  [Mount.Page]: { ownsTitle: true, closes: false, stage: Stage.Own, zoom: Zoom.Stage },
  [Mount.Canvas]: { ownsTitle: false, closes: true, stage: Stage.Node, zoom: Zoom.Canvas }
};

const STILL_FRAMES = 1;

export const timelineFits = (doc: Pick<MotionDoc, 'durationInFrames'>) => doc.durationInFrames > STILL_FRAMES;
