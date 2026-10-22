import type { MotionDoc } from './doc';

const STILL_FRAMES = 1;

export const timelineFits = (doc: Pick<MotionDoc, 'durationInFrames'>) => doc.durationInFrames > STILL_FRAMES;
