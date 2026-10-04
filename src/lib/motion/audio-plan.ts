import type { ComponentId } from './components';
import { clipsOf, type MotionClip, type MotionDoc } from './doc';
import { isRemapped } from './time-remap';

export type AudioEntry = { clipId: string; url: string; at: number; offset: number; duration: number; volume: number; fadeIn: number; fadeOut: number };
export type GainPoint = { time: number; value: number };

type Sound = { assetId?: string | null; volume?: number; fadeIn?: number; fadeOut?: number };

const AUDIBLE: Partial<Record<ComponentId, (p: Sound, clip: MotionClip) => boolean>> = {
  Audio: (p) => (p.volume ?? 0) > 0,
  Video: (p, clip) => (p.volume ?? 0) > 0 && !isRemapped(clip)
};

function entryOf(clip: MotionClip, doc: MotionDoc, url: string): AudioEntry | null {
  const p = clip.props as Sound;
  const end = Math.min(clip.from + clip.durationInFrames, doc.durationInFrames);
  if (end <= clip.from) {
    return null;
  }
  const duration = (end - clip.from) / doc.fps;
  const half = duration / 2;
  return {
    clipId: clip.id,
    url,
    at: clip.from / doc.fps,
    offset: clip.trimStart / doc.fps,
    duration,
    volume: p.volume ?? 0,
    fadeIn: Math.min(p.fadeIn ?? 0, half),
    fadeOut: Math.min(p.fadeOut ?? 0, half)
  };
}

export function audioPlan(doc: MotionDoc, urls: Record<string, string>): AudioEntry[] {
  return clipsOf(doc).flatMap((clip) => {
    const audible = AUDIBLE[clip.component];
    const p = clip.props as Sound;
    const url = p.assetId ? urls[p.assetId] : undefined;
    if (!audible?.(p, clip) || !url) {
      return [];
    }
    const entry = entryOf(clip, doc, url);
    return entry ? [entry] : [];
  });
}

export function gainCurve(e: Pick<AudioEntry, 'at' | 'duration' | 'volume' | 'fadeIn' | 'fadeOut'>): GainPoint[] {
  const end = e.at + e.duration;
  const points: GainPoint[] = [{ time: e.at, value: e.fadeIn > 0 ? 0 : e.volume }];
  if (e.fadeIn > 0) {
    points.push({ time: e.at + e.fadeIn, value: e.volume });
  }
  points.push({ time: end - e.fadeOut, value: e.volume });
  if (e.fadeOut > 0) {
    points.push({ time: end, value: 0 });
  }
  return points;
}
