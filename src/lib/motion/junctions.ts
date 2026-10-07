import { TrackKind } from './components';
import { TransitionKind } from './design';
import type { MotionClip, MotionDoc } from './doc';
import type { Junction, JunctionKind } from './junction-model';

export * from './junction-model';

export type JunctionPair = { outgoing: string; incoming: string; kind: JunctionKind; durationInFrames: number };

const NO_EDGE = { kind: TransitionKind.None, durationInFrames: 0 };

type Placed = { clip: MotionClip; track: number };

function visualClips(doc: MotionDoc): Placed[] {
  return doc.tracks.flatMap((t, track) => (t.kind === TrackKind.Visual ? (t.clips as MotionClip[]).map((clip) => ({ clip, track })) : []));
}

function partnerOf(placed: Placed[], incoming: Placed): Placed | null {
  const before = placed.filter((p) => p.clip.id !== incoming.clip.id && p.clip.from + p.clip.durationInFrames === incoming.clip.from);
  return before.find((p) => p.track === incoming.track) ?? before[0] ?? null;
}

export function junctionProblem(doc: MotionDoc, clipId: string): string | null {
  const placed = visualClips(doc);
  const incoming = placed.find((p) => p.clip.id === clipId);
  if (!incoming) {
    return `no visual clip ${clipId}`;
  }
  return partnerOf(placed, incoming) ? null : `nothing ends where ${clipId} starts: move a clip so it ends at ${clipId}'s start to transition between them`;
}

export function junctionPairs(doc: MotionDoc): JunctionPair[] {
  const placed = visualClips(doc);
  return placed.flatMap((incoming) => {
    const junction: Junction | null | undefined = incoming.clip.junction;
    const outgoing = junction ? partnerOf(placed, incoming) : null;
    return junction && outgoing ? [{ outgoing: outgoing.clip.id, incoming: incoming.clip.id, kind: junction.kind, durationInFrames: junction.durationInFrames }] : [];
  });
}

export function junctionHalves(durationInFrames: number): { before: number; after: number } {
  const before = Math.floor(durationInFrames / 2);
  return { before, after: durationInFrames - before };
}

function shiftKeyframes(clip: MotionClip, frames: number): MotionClip['keyframes'] {
  return Object.fromEntries(Object.entries(clip.keyframes).map(([prop, keys]) => [prop, keys.map((k) => ({ ...k, frame: k.frame + frames }))]));
}

export function withJunctions(doc: MotionDoc): MotionDoc {
  const pairs = junctionPairs(doc);
  if (!pairs.length) {
    return doc;
  }
  const outgoing = new Map(pairs.map((p) => [p.outgoing, junctionHalves(p.durationInFrames).after]));
  const incoming = new Map(pairs.map((p) => [p.incoming, junctionHalves(p.durationInFrames).before]));

  const joined = (clip: MotionClip): MotionClip => {
    const after = outgoing.get(clip.id) ?? 0;
    const before = incoming.get(clip.id) ?? 0;
    if (!after && !before) {
      return clip;
    }
    return {
      ...clip,
      from: clip.from - before,
      durationInFrames: clip.durationInFrames + before + after,
      trimStart: Math.max(0, clip.trimStart - before),
      keyframes: before ? shiftKeyframes(clip, before) : clip.keyframes,
      transitionIn: incoming.has(clip.id) ? NO_EDGE : clip.transitionIn,
      transitionOut: outgoing.has(clip.id) ? NO_EDGE : clip.transitionOut
    };
  };
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(joined) })) };
}
