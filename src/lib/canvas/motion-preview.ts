import { timecode } from '$lib/motion/timeline-view';

export enum Sight {
  InView = 'in-view',
  OutOfView = 'out-of-view'
}

export enum Intent {
  Play = 'play',
  Rest = 'rest'
}

export enum Still {
  Ready = 'ready',
  Missing = 'missing'
}

export enum PreviewMode {
  Live = 'live',
  Poster = 'poster',
  Capture = 'capture'
}

export type MotionPreview = { version: number; html: string; width: number; height: number; fps: number; durationInFrames: number };

const OUT_OF_VIEW = { [Still.Ready]: PreviewMode.Poster, [Still.Missing]: PreviewMode.Poster };

const POLICY: Record<Sight, Record<Intent, Record<Still, PreviewMode>>> = {
  [Sight.InView]: {
    [Intent.Play]: { [Still.Ready]: PreviewMode.Live, [Still.Missing]: PreviewMode.Live },
    [Intent.Rest]: { [Still.Ready]: PreviewMode.Poster, [Still.Missing]: PreviewMode.Capture }
  },
  [Sight.OutOfView]: { [Intent.Play]: OUT_OF_VIEW, [Intent.Rest]: OUT_OF_VIEW }
};

export function previewMode(sight: Sight, intent: Intent, still: Still): PreviewMode {
  return POLICY[sight][intent][still];
}

export type Slots = { playing: string | null; capturing: string | null };

export const intentOf = (slots: Slots, id: string): Intent => (slots.playing === id ? Intent.Play : Intent.Rest);

export const play = (slots: Slots, id: string): Slots => ({ ...slots, playing: id });

export const stop = (slots: Slots, id: string): Slots => (slots.playing === id ? { ...slots, playing: null } : slots);

export const captureFree = (slots: Slots): boolean => slots.capturing === null;

export const claimCapture = (slots: Slots, id: string): Slots => (captureFree(slots) ? { ...slots, capturing: id } : slots);

export const releaseCapture = (slots: Slots, id: string): Slots => (slots.capturing === id ? { ...slots, capturing: null } : slots);

export function scrubFrame(ratio: number, durationInFrames: number): number {
  const last = Math.max(0, durationInFrames - 1);
  return Math.min(last, Math.max(0, Math.round(ratio * durationInFrames)));
}

export function previewClock(frame: number, fps: number, durationInFrames: number): string {
  return `${timecode(frame, fps)} / ${timecode(durationInFrames, fps)}`;
}
