import type { MotionClip, MotionDoc, MotionTrack } from '@feega/motion-core/motion/doc';
import { sameColour } from './page-tokens';
import { viewOnly } from './page-views';

const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

type Counts = Map<string, number>;

function counted(value: unknown, counts: Counts): void {
  if (typeof value === 'string') {
    const hex = value.match(HEX)?.[1];
    if (hex) {
      counts.set(`#${hex.toLowerCase()}`, (counts.get(`#${hex.toLowerCase()}`) ?? 0) + 1);
    }
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => counted(v, counts));
  }
}

function canonOf(counts: Counts): Map<string, string> {
  const heaviest = [...counts].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const kept: string[] = [];
  const canon = new Map<string, string>();
  for (const hex of heaviest) {
    const home = kept.find((k) => sameColour(k, hex));
    if (!home) {
      kept.push(hex);
    }
    canon.set(hex, home ?? hex);
  }
  return canon;
}

function snapped(value: unknown, canon: Map<string, string>): unknown {
  if (typeof value === 'string') {
    const m = value.match(HEX);
    const to = m ? canon.get(`#${m[1].toLowerCase()}`) : undefined;
    return to && m ? `${to}${m[2] ?? ''}` : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => snapped(v, canon));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, snapped(v, canon)]));
  }
  return value;
}

const clipsIn = (doc: MotionDoc): MotionClip[] => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);

const snappedTracks = (tracks: MotionTrack[], canon: Map<string, string>): MotionTrack[] => tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => ({ ...c, props: snapped(c.props, canon) as MotionClip['props'] })) }));

export function coloursMerged(doc: MotionDoc): MotionDoc {
  const counts: Counts = new Map();
  clipsIn(doc)
    .filter((c) => !viewOnly(c))
    .forEach((c) => counted(c.props, counts));
  const canon = canonOf(counts);
  return { ...doc, tracks: snappedTracks(doc.tracks, canon), comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: snappedTracks(comp.tracks, canon) }])) };
}
