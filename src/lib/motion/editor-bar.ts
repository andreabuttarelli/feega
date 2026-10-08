import { FORMATS, formatOf, type MotionDoc } from './doc';
import { secondsLabel } from './inspector';
import { timecode } from './timeline-view';

export enum TimeDisplay {
  Timecode = 'timecode',
  Frames = 'frames'
}

export enum SaveState {
  Saved = 'Saved',
  Saving = 'Saving…',
  Pending = 'Unsaved',
  Conflict = 'Reloaded the latest version',
  Failed = 'Not saved'
}

export enum SaveTone {
  Done = 'done',
  Busy = 'busy',
  Error = 'error'
}

export const SAVE_TONE: Record<SaveState, SaveTone> = {
  [SaveState.Saved]: SaveTone.Done,
  [SaveState.Saving]: SaveTone.Busy,
  [SaveState.Pending]: SaveTone.Busy,
  [SaveState.Conflict]: SaveTone.Done,
  [SaveState.Failed]: SaveTone.Error
};

const CLOCK: Record<TimeDisplay, (frame: number, fps: number) => string> = {
  [TimeDisplay.Timecode]: timecode,
  [TimeDisplay.Frames]: (frame) => String(frame)
};

export const clockLabel = (frame: number, fps: number, display: TimeDisplay): string => CLOCK[display](frame, fps);

export const DISPLAY_NAME: Record<TimeDisplay, string> = {
  [TimeDisplay.Timecode]: 'Timecode',
  [TimeDisplay.Frames]: 'Frames'
};

type Point = { x: number; y: number };

const TAP_SLOP_PX = 8;

export const isTap = (from: Point, to: Point): boolean => Math.hypot(to.x - from.x, to.y - from.y) < TAP_SLOP_PX;

export function compositionLabel(doc: Pick<MotionDoc, 'width' | 'height' | 'fps' | 'durationInFrames'>): string {
  return `${FORMATS[formatOf(doc)].label} · ${doc.width}×${doc.height} · ${doc.fps}fps · ${secondsLabel(doc.durationInFrames, doc.fps)}s`;
}

export function compositionShort(doc: Pick<MotionDoc, 'width' | 'height' | 'fps' | 'durationInFrames'>): string {
  return `${FORMATS[formatOf(doc)].label} · ${secondsLabel(doc.durationInFrames, doc.fps)}s`;
}
