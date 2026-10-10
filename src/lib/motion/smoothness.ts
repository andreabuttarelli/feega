export enum Jolt {
  Pop = 'pop',
  Stop = 'stop',
  Flicker = 'flicker'
}

export type JoltAt = { frame: number; kind: Jolt; value: number; around: number };

export type JoltLimits = { cuts?: readonly number[]; popRatio?: number; popFloor?: number; stopSpeed?: number; stopRatio?: number; flickerDelta?: number };

const LIMITS: Required<Omit<JoltLimits, 'cuts'>> = { popRatio: 3, popFloor: 1, stopSpeed: 3, stopRatio: 0.15, flickerDelta: 0.2 };
const NEIGHBOURS = 3;
const FLICKER_WINDOW = 8;
const FLICKER_FLIPS = 3;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? 0;
};

export function frameDiffs(frames: readonly ArrayLike<number>[]): number[] {
  return frames.slice(1).map((frame, i) => {
    const before = frames[i];
    let sum = 0;
    for (let p = 0; p < frame.length; p++) {
      sum += Math.abs(frame[p] - before[p]);
    }
    return sum / frame.length;
  });
}

function pops(d: readonly number[], at: Required<Omit<JoltLimits, 'cuts'>>, cut: (i: number) => boolean): JoltAt[] {
  return d.flatMap((value, i) => {
    if (cut(i) || value <= at.popFloor) {
      return [];
    }
    const around = median([...d.slice(Math.max(0, i - NEIGHBOURS), i), ...d.slice(i + 1, i + 1 + NEIGHBOURS)]);
    return value > at.popRatio * around && value > at.popRatio * (d[i - 1] ?? 0) ? [{ frame: i, kind: Jolt.Pop, value, around }] : [];
  });
}

function stops(d: readonly number[], at: Required<Omit<JoltLimits, 'cuts'>>, cut: (i: number) => boolean): JoltAt[] {
  return d.flatMap((value, i) => {
    const before = d[i - 1] ?? 0;
    const sustained = Math.min(before, d[i - 2] ?? 0);
    return !cut(i) && !cut(i - 1) && sustained > at.stopSpeed && value < before * at.stopRatio ? [{ frame: i, kind: Jolt.Stop, value, around: before }] : [];
  });
}

function flickers(d: readonly number[], at: Required<Omit<JoltLimits, 'cuts'>>): JoltAt[] {
  const found: JoltAt[] = [];
  for (let i = 0; i + FLICKER_WINDOW <= d.length; i++) {
    const deltas = d.slice(i + 1, i + FLICKER_WINDOW).map((v, k) => v - d[i + k]).filter((delta) => Math.abs(delta) > at.flickerDelta);
    const flips = deltas.slice(1).filter((delta, k) => Math.sign(delta) !== Math.sign(deltas[k])).length;
    if (flips < FLICKER_FLIPS) {
      continue;
    }
    found.push({ frame: i, kind: Jolt.Flicker, value: Math.max(...d.slice(i, i + FLICKER_WINDOW)), around: median(d.slice(i, i + FLICKER_WINDOW)) });
    i += FLICKER_WINDOW - 1;
  }
  return found;
}

export function motionJolts(diffs: readonly number[], limits: JoltLimits = {}): JoltAt[] {
  const at = { ...LIMITS, ...limits };
  const cuts = new Set(limits.cuts ?? []);
  const cut = (i: number) => cuts.has(i);
  return [...pops(diffs, at, cut), ...stops(diffs, at, cut), ...flickers(diffs.map((v, i) => (cut(i) ? (diffs[i - 1] ?? 0) : v)), at)].sort((a, b) => a.frame - b.frame);
}

const LUMA = { r: 0.299, g: 0.587, b: 0.114 };
const RGBA = 4;

export function lumaOf(rgba: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(rgba.length / RGBA);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.round(LUMA.r * rgba[i * RGBA] + LUMA.g * rgba[i * RGBA + 1] + LUMA.b * rgba[i * RGBA + 2]);
  }
  return out;
}

export type JoltMeter = { add: (frame: ArrayLike<number>) => void; jolts: (limits: JoltLimits) => JoltAt[] };

export function joltMeter(): JoltMeter {
  const diffs: number[] = [];
  let last: ArrayLike<number> | null = null;
  return {
    add: (frame) => {
      if (last) {
        diffs.push(...frameDiffs([last, frame]));
      }
      last = frame;
    },
    jolts: (limits) => motionJolts(diffs, limits)
  };
}

type Edged = { from: number; durationInFrames: number; junction?: unknown };

export function docCuts(doc: { tracks: readonly { clips: readonly Edged[] }[] }): number[] {
  const clips = doc.tracks.flatMap((t) => t.clips);
  const joined = new Set(clips.filter((c) => c.junction).map((c) => c.from));
  const edges = clips.flatMap((c) => [c.from, c.from + c.durationInFrames]).filter((f) => !joined.has(f));
  return [...new Set(edges.flatMap((f) => [f - 1, f]))].sort((a, b) => a - b);
}

export function joltNote(jolts: readonly JoltAt[], fps: number): string {
  if (!jolts.length) {
    return 'Smooth: no frame jumps.';
  }
  const at = jolts.map((j) => `${((j.frame + 1) / fps).toFixed(1)} s (${j.kind})`);
  const listed = at.length > 1 ? `${at.slice(0, -1).join(', ')} and ${at.at(-1)}` : at[0];
  return `${jolts.length} frame jump${jolts.length > 1 ? 's' : ''}, at ${listed}: ask the agent to smooth them.`;
}
