import type { ClipError } from '../hyperframes/capture';
import { TrackKind } from '../components';
import { TransitionKind } from '../design';
import { clipsOf, newClip, type MotionDoc } from '../doc';
import { CheckState, ComponentMode, checkState } from './component';

export const CHECK_POINTS = 5;
const SPREAD = [0.1, 0.3, 0.5, 0.7, 0.92];
const SCRAMBLE = [2, 4, 0, 3, 1];
const MAX_PROBLEMS = 6;
const JPEG_BLOCK = 8;
const BLOCK_NOISE = 2;

export type Luma = { width: number; values: Uint8Array };
export type Shot = { time: number; image: string; luma: Luma; layout: string; errors: ClipError[] };
export type Verdict = { ok: boolean; problems: string[]; offending: Shot[] };

export function seekPlan(seconds: number, fps: number): number[] {
  const last = Math.max(0, Math.floor(seconds * fps) - 1);
  const points = SPREAD.map((f) => Math.min(last, Math.round(seconds * f * fps)) / fps);
  return [...points, ...points, ...[...points].reverse(), ...SCRAMBLE.map((i) => points[i])];
}

const seconds = (t: number) => `${Math.round(t * 100) / 100}s`;

function blockMeans({ width, values }: Luma): Float64Array {
  const across = Math.ceil(width / JPEG_BLOCK);
  const rows = Math.ceil(values.length / width / JPEG_BLOCK);
  const sums = new Float64Array(across * rows);
  const counts = new Float64Array(across * rows);
  values.forEach((v, p) => {
    const block = Math.floor(p / width / JPEG_BLOCK) * across + Math.floor((p % width) / JPEG_BLOCK);
    sums[block] += v;
    counts[block]++;
  });
  return sums.map((sum, b) => sum / counts[b]);
}

function samePicture(a: Shot, b: Shot): boolean {
  if (a.image === b.image) {
    return true;
  }
  if (a.luma.width !== b.luma.width || a.luma.values.length !== b.luma.values.length) {
    return false;
  }
  const before = blockMeans(a.luma);
  return blockMeans(b.luma).every((v, block) => Math.abs(v - before[block]) <= BLOCK_NOISE);
}

export function verdictOf(shots: Shot[]): Verdict {
  const problems: string[] = [];
  const offending: Shot[] = [];
  const first = new Map<number, Shot>();

  for (const [order, shot] of shots.entries()) {
    if (order < CHECK_POINTS) {
      continue;
    }
    const seen = first.get(shot.time);
    if (!seen) {
      first.set(shot.time, shot);
      continue;
    }
    if (!samePicture(seen, shot)) {
      problems.push(`the frame at ${seconds(shot.time)} differs between visits (visit ${order + 1} after seeking from ${seconds(shots[order - 1].time)}): state leaks between seeks`);
      offending.push(seen, shot);
      continue;
    }
    if (seen.layout !== shot.layout) {
      problems.push(`the layout at ${seconds(shot.time)} moves between visits: boxes depend on seek history`);
      offending.push(seen, shot);
    }
  }

  const thrown = [...new Set(shots.flatMap((s) => s.errors.map((e) => `${e.component || 'the page'} threw: ${e.message}`)))];
  const all = [...new Set([...thrown, ...problems])].slice(0, MAX_PROBLEMS);
  return { ok: all.length === 0, problems: all, offending: offending.slice(0, 2) };
}

const DEFAULT_CHECK_FRAMES = 120;

export function checkDoc(doc: MotionDoc, name: string): MotionDoc {
  const first = clipsOf(doc).find((c) => c.component === 'Custom' && c.props.name === name);
  const durationInFrames = first?.durationInFrames ?? DEFAULT_CHECK_FRAMES;
  const clip = newClip({ id: 'check', from: 0, durationInFrames, component: 'Custom', props: first?.props ?? { name } });
  return {
    ...doc,
    durationInFrames,
    tracks: [{ id: 'check', kind: TrackKind.Visual, name: 'Check', clips: [clip] }] as MotionDoc['tracks'],
    components: { [name]: doc.components[name] }
  };
}

export type Unverified = { name: string; state: CheckState };

const usedComponents = (doc: MotionDoc) => new Set(clipsOf(doc).filter((c) => c.component === 'Custom').map((c) => String(c.props.name)));

export const liveNote = (names: readonly string[]) => `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} live: it will look different in the video (a still stands in); export it as Embed`;

export function liveComponents(doc: MotionDoc): string[] {
  return [...usedComponents(doc)].filter((name) => doc.components[name]?.mode === ComponentMode.Live);
}

export function unverified(doc: MotionDoc): Unverified[] {
  const used = usedComponents(doc);
  return [...used]
    .filter((name) => doc.components[name])
    .map((name) => ({ name, state: checkState(doc.components[name]) }))
    .filter((u) => u.state !== CheckState.Passed);
}
