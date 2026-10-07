import { TrackKind } from './components';
import { findClip, type MotionClip, type MotionDoc } from './doc';
import { Matte } from './mask';

export const MATTE_OPAQUE = 255;

const REC_709: [number, number, number] = [0.2125, 0.7154, 0.0721];

export type MatteRead = { weights: [number, number, number] | null; invert: boolean };

export const MATTE_READ: Record<Exclude<Matte, Matte.None>, MatteRead> = {
  [Matte.Alpha]: { weights: null, invert: false },
  [Matte.AlphaInverted]: { weights: null, invert: true },
  [Matte.Luma]: { weights: REC_709, invert: false },
  [Matte.LumaInverted]: { weights: REC_709, invert: true }
};

export function matteAlpha(read: MatteRead, r: number, g: number, b: number, a: number): number {
  const opaque = 255;
  const w = read.weights;
  const level = w ? Math.round(((w[0] * r + w[1] * g + w[2] * b) * a) / opaque) : a;
  return read.invert ? opaque - level : level;
}

export type MattePair = { target: string; source: string; matte: Exclude<Matte, Matte.None> };

const overlap = (a: MotionClip, b: MotionClip) => Math.min(a.from + a.durationInFrames, b.from + b.durationInFrames) - Math.max(a.from, b.from);

export function matteSource(doc: MotionDoc, clipId: string): MotionClip | null {
  const found = findClip(doc, clipId);
  const index = found ? doc.tracks.indexOf(found.track) : -1;
  const above = doc.tracks[index - 1];
  if (!found || !above || above.kind !== TrackKind.Visual) {
    return null;
  }

  const candidates = (above.clips as MotionClip[]).filter((c) => overlap(c, found.clip) > 0);
  return candidates.sort((a, b) => overlap(b, found.clip) - overlap(a, found.clip))[0] ?? null;
}

export function mattePairs(doc: MotionDoc): MattePair[] {
  const matted = doc.tracks.flatMap((t) => (t.clips as MotionClip[]).filter((c) => c.matte !== Matte.None));
  return matted.flatMap((c) => {
    const source = matteSource(doc, c.id);
    return source ? [{ target: c.id, source: source.id, matte: c.matte as MattePair['matte'] }] : [];
  });
}

export function hiddenMattes(doc: MotionDoc): Set<string> {
  return new Set(mattePairs(doc).map((p) => p.source));
}
