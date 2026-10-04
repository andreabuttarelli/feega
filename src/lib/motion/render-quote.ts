import type { MotionDoc } from './doc';

export enum Resolution {
  P720 = '720p',
  P1080 = '1080p'
}

const RESOLUTION_FACTOR: Record<Resolution, number> = { [Resolution.P720]: 1, [Resolution.P1080]: 2 };
const SECONDS_PER_UNIT = 10;
const FULL_HD_SHORT_SIDE = 1080;

export type RenderQuote = { seconds: number; resolution: Resolution; credits: number };

export function resolutionOf(doc: Pick<MotionDoc, 'width' | 'height'>): Resolution {
  return Math.min(doc.width, doc.height) >= FULL_HD_SHORT_SIDE ? Resolution.P1080 : Resolution.P720;
}

export function renderQuote(doc: Pick<MotionDoc, 'width' | 'height' | 'durationInFrames' | 'fps'> & Partial<Pick<MotionDoc, 'motionBlur'>>): RenderQuote {
  const seconds = doc.durationInFrames / doc.fps;
  const resolution = resolutionOf(doc);
  const samples = doc.motionBlur?.enabled ? doc.motionBlur.samples : 1;
  return { seconds, resolution, credits: Math.ceil(seconds / SECONDS_PER_UNIT) * RESOLUTION_FACTOR[resolution] * samples };
}
