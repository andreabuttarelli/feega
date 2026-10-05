import type { ComponentId } from './components';
import { clipsOf, type MotionClip, type MotionDoc } from './doc';
import { flattenComps } from './precomp';
import { SOUND, sampleTrack } from './keyframes';

export type GainPoint = { time: number; value: number };
export type AudioEntry = { clipId: string; url: string; at: number; offset: number; duration: number; left: GainPoint[]; right: GainPoint[] };

type Sound = { assetId?: string | null; volume?: number; pan?: number; fadeIn?: number; fadeOut?: number };

const SOUNDING: ReadonlySet<ComponentId> = new Set(['Audio', 'Video']);
const SILENT_BELOW = 1e-4;
const COLLINEAR_WITHIN = 1e-6;
const PRECISION = 10_000;

const round = (n: number) => Math.round(n * PRECISION) / PRECISION;
const rounded = (points: GainPoint[]) => points.map((p) => ({ time: round(p.time), value: round(p.value) }));

function level(clip: MotionClip, key: keyof typeof SOUND, local: number): number {
  const track = clip.keyframes[key];
  if (track?.length) {
    return sampleTrack(track, local);
  }
  return (clip.props as Sound)[key] ?? SOUND[key].fallback;
}

function fadeAt(seconds: number, length: number, fadeIn: number, fadeOut: number): number {
  const up = fadeIn > 0 ? Math.min(1, seconds / fadeIn) : 1;
  const down = fadeOut > 0 ? Math.min(1, (length - seconds) / fadeOut) : 1;
  return Math.max(0, Math.min(up, down));
}

function collinear(a: GainPoint, b: GainPoint, c: GainPoint): boolean {
  const expected = a.value + ((c.value - a.value) * (b.time - a.time)) / (c.time - a.time);
  return Math.abs(expected - b.value) < COLLINEAR_WITHIN;
}

export function simplified(points: GainPoint[]): GainPoint[] {
  const kept: GainPoint[] = [];
  for (const [i, point] of points.entries()) {
    const next = points[i + 1];
    const last = kept[kept.length - 1];
    if (last && next && collinear(last, point, next)) {
      continue;
    }
    kept.push(point);
  }
  return kept;
}

function envelopes(clip: MotionClip, doc: MotionDoc, frames: number): { left: GainPoint[]; right: GainPoint[] } {
  const p = clip.props as Sound;
  const length = frames / doc.fps;
  const fadeIn = Math.min(p.fadeIn ?? 0, length / 2);
  const fadeOut = Math.min(p.fadeOut ?? 0, length / 2);
  const fadeFrames = [fadeIn, length - fadeOut].map((s) => s * doc.fps);
  const ticks = [...new Set([...Array.from({ length: frames + 1 }, (_, f) => f), ...fadeFrames])].sort((a, b) => a - b);

  const left: GainPoint[] = [];
  const right: GainPoint[] = [];
  for (const local of ticks) {
    const seconds = local / doc.fps;
    const gain = level(clip, 'volume', local) * fadeAt(seconds, length, fadeIn, fadeOut);
    const pan = level(clip, 'pan', local);
    const time = (clip.from + local) / doc.fps;
    left.push({ time, value: gain * Math.min(1, 1 - pan) });
    right.push({ time, value: gain * Math.min(1, 1 + pan) });
  }
  return { left: rounded(simplified(left)), right: rounded(simplified(right)) };
}

const audible = (points: GainPoint[]) => points.some((p) => p.value > SILENT_BELOW);

function entryOf(clip: MotionClip, doc: MotionDoc, url: string): AudioEntry | null {
  const end = Math.min(clip.from + clip.durationInFrames, doc.durationInFrames);
  if (end <= clip.from) {
    return null;
  }
  const { left, right } = envelopes(clip, doc, end - clip.from);
  if (!audible(left) && !audible(right)) {
    return null;
  }
  return { clipId: clip.id, url, at: clip.from / doc.fps, offset: clip.trimStart / doc.fps, duration: (end - clip.from) / doc.fps, left, right };
}

export function audioPlan(doc: MotionDoc, urls: Record<string, string>): AudioEntry[] {
  return clipsOf(flattenComps(doc)).flatMap((clip) => {
    const p = clip.props as Sound;
    const url = p.assetId ? urls[p.assetId] : undefined;
    if (!SOUNDING.has(clip.component) || !url) {
      return [];
    }
    const entry = entryOf(clip, doc, url);
    return entry ? [entry] : [];
  });
}

export function gainAt(points: readonly GainPoint[], time: number): number {
  const next = points.findIndex((p) => p.time > time);
  if (next === 0) {
    return points[0].value;
  }
  if (next < 0) {
    return points[points.length - 1].value;
  }
  const a = points[next - 1];
  const b = points[next];
  return a.value + ((b.value - a.value) * (time - a.time)) / (b.time - a.time);
}
