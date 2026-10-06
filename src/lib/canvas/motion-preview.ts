import { timecode } from '$lib/motion/timeline-view';

export enum Sight {
  InView = 'in-view',
  OutOfView = 'out-of-view'
}

export enum Engagement {
  Engaged = 'engaged',
  Idle = 'idle'
}

export enum PreviewMode {
  Live = 'live',
  Poster = 'poster'
}

export type MotionPreview = { version: number; html: string; width: number; height: number; fps: number; durationInFrames: number };

export function previewMode(sight: Sight, engagement: Engagement): PreviewMode {
  return sight === Sight.InView && engagement === Engagement.Engaged ? PreviewMode.Live : PreviewMode.Poster;
}

export function scrubFrame(ratio: number, durationInFrames: number): number {
  const last = Math.max(0, durationInFrames - 1);
  return Math.min(last, Math.max(0, Math.round(ratio * durationInFrames)));
}

export function previewClock(frame: number, fps: number, durationInFrames: number): string {
  return `${timecode(frame, fps)} / ${timecode(durationInFrames, fps)}`;
}
