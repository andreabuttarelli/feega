import type { AudioAnalysis } from './audio-analysis';
import { clipsOf, findClip, type MotionClip, type MotionDoc } from './doc';
import { setTiming, type OpResult } from './timeline';

export enum Hit {
  Beats = 'beats',
  Onsets = 'onsets'
}

const TIMES: Record<Hit, (a: AudioAnalysis) => number[]> = {
  [Hit.Beats]: (a) => a.beats,
  [Hit.Onsets]: (a) => a.onsets
};

export function musicBed(doc: MotionDoc, analyses: Record<string, AudioAnalysis>): MotionClip | null {
  const tempo = clipsOf(doc).filter((c) => c.component === 'Audio' && analyses[String(c.props.assetId ?? '')]?.bpm);
  return tempo.reduce<MotionClip | null>((longest, c) => (!longest || c.durationInFrames > longest.durationInFrames ? c : longest), null);
}

export function hitFrames(doc: MotionDoc, analyses: Record<string, AudioAnalysis>, hit: Hit): number[] {
  const clip = musicBed(doc, analyses);
  if (!clip) {
    return [];
  }
  const analysis = analyses[String(clip.props.assetId)];
  const end = clip.from + clip.durationInFrames;
  return TIMES[hit](analysis)
    .map((t) => Math.round(clip.from + t * doc.fps - clip.trimStart))
    .filter((f) => f >= clip.from && f < end);
}

function nearest(beats: readonly number[], frame: number): number {
  return beats.reduce((best, b) => (Math.abs(b - frame) < Math.abs(best - frame) ? b : best), beats[0]);
}

export function cutToBeat(doc: MotionDoc, clipIds: readonly string[], beats: readonly number[]): OpResult {
  if (!beats.length) {
    return { ok: false, error: 'no beats to cut to: add a music clip with an analysed beat' };
  }
  const clips = clipIds.flatMap((id) => findClip(doc, id)?.clip ?? []).sort((a, b) => a.from - b.from);
  if (!clips.length) {
    return { ok: false, error: 'select the clips to cut to the beat' };
  }

  let result: OpResult = { ok: true, doc };
  let start = nearest(beats, clips[0].from);
  for (const clip of clips) {
    const later = beats.filter((b) => b > start);
    const end = later.length ? nearest(later, start + clip.durationInFrames) : start + clip.durationInFrames;
    if (!result.ok) {
      return result;
    }
    result = setTiming(result.doc, clip.id, { from: start, durationInFrames: end - start });
    start = end;
  }
  return result;
}
