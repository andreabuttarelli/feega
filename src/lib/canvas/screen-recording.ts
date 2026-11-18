export const RECORD_MAX_SECONDS = 60;

const PREFERRED_MIMES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] as const;
const SECONDS_PER_MINUTE = 60;
const EVEN = 2;

export enum RecordPhase {
  Idle = 'idle',
  Recording = 'recording',
  Saved = 'saved'
}

export type Area = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Crop = { sx: number; sy: number; sw: number; sh: number };

export const videoMime = (isSupported: (mime: string) => boolean): string => PREFERRED_MIMES.find((m) => isSupported(m)) ?? '';

export function recordingFileName(at: Date, mime: string): string {
  const stamp = at.toISOString().slice(0, 19).replace('T', '-').replaceAll(':', '');
  return `canvas-recording-${stamp}.${mime.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
}

const even = (n: number) => Math.max(EVEN, Math.floor(n / EVEN) * EVEN);

export function cropOf(area: Area, source: Size, ratio: number): Crop {
  const sx = Math.max(0, Math.round(area.x * ratio));
  const sy = Math.max(0, Math.round(area.y * ratio));
  const sw = Math.min(source.width - sx, Math.round(area.width * ratio) + Math.min(0, Math.round(area.x * ratio)));
  const sh = Math.min(source.height - sy, Math.round(area.height * ratio) + Math.min(0, Math.round(area.y * ratio)));
  return { sx, sy, sw: even(sw), sh: even(sh) };
}

export function clockLabel(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / SECONDS_PER_MINUTE)}:${String(whole % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}
