import { z } from 'zod';
import { Ease } from './design';
import { sampleTrack, type Keyframe, type Keyframes, type Transform } from './keyframes';

export const pathTangentSchema = z.object({
  frame: z.number().int().min(0),
  in: z.tuple([z.number(), z.number()]),
  out: z.tuple([z.number(), z.number()])
});

export const motionPathSchema = z.object({
  autoOrient: z.boolean().default(false),
  tangents: z.array(pathTangentSchema).default([])
});

export type PathTangent = z.infer<typeof pathTangentSchema>;
export type MotionPath = z.infer<typeof motionPathSchema>;

type Size = { width: number; height: number };
type Vec = [number, number, number];
type Segment = [Vec, Vec, Vec, Vec];
type PathClip = { keyframes: Keyframes; transform: Transform; path: MotionPath | null };
export type PathSample = { x: number; y: number; z: number; angle: number };

const ARC_STEPS = 64;
const AUTO_TANGENT = 1 / 6;
const DEGREES = 180 / Math.PI;
const TANGENT_EPSILON = 1e-4;

export function pathProblem(clip: PathClip): string | null {
  if (!clip.path) {
    return null;
  }
  const x = clip.keyframes.x ?? [];
  const y = clip.keyframes.y ?? [];
  const same = x.length === y.length && x.every((k, i) => k.frame === y[i].frame);
  return x.length >= 2 && same ? null : 'a motion path needs x and y keyed at the same times, two or more';
}

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const times = (a: Vec, n: number): Vec => [a[0] * n, a[1] * n, a[2] * n];
const length = (a: Vec) => Math.hypot(a[0], a[1], a[2]);

function zAt(clip: PathClip, frame: number): number {
  const track = clip.keyframes.z;
  return track?.length ? sampleTrack(track, frame) : (clip.transform.z ?? 0);
}

function keyPoints(clip: PathClip, size: Size): Vec[] {
  const y = clip.keyframes.y!;
  return clip.keyframes.x!.map((k, i) => [Number(k.value) * size.width, Number(y[i].value) * size.height, zAt(clip, k.frame)]);
}

function segments(clip: PathClip, points: Vec[], size: Size): Segment[] {
  const frames = clip.keyframes.x!.map((k) => k.frame);
  const last = points.length - 1;
  const explicit = (i: number) => clip.path!.tangents.find((t) => t.frame === frames[i]);
  const scaled = (v: [number, number]): Vec => [v[0] * size.width, v[1] * size.height, 0];
  const auto = (i: number) => times(sub(points[Math.min(i + 1, last)], points[Math.max(i - 1, 0)]), AUTO_TANGENT);

  return points.slice(0, -1).map((p0, i) => {
    const p3 = points[i + 1];
    const out = explicit(i);
    const into = explicit(i + 1);
    return [p0, add(p0, out ? scaled(out.out) : auto(i)), add(p3, into ? scaled(into.in) : times(auto(i + 1), -1)), p3];
  });
}

export type PathHandle = { frame: number; point: [number, number]; in: [number, number]; out: [number, number] };

export function pathHandles(clip: PathClip, size: Size): PathHandle[] | null {
  if (!clip.path || pathProblem(clip)) {
    return null;
  }
  const points = keyPoints(clip, size);
  const segs = segments(clip, points, size);
  const offset = (from: Vec, to: Vec): [number, number] => [(to[0] - from[0]) / size.width, (to[1] - from[1]) / size.height];
  return clip.keyframes.x!.map((k, i) => ({
    frame: k.frame,
    point: [points[i][0] / size.width, points[i][1] / size.height],
    in: i > 0 ? offset(points[i], segs[i - 1][2]) : [0, 0],
    out: i < segs.length ? offset(points[i], segs[i][1]) : [0, 0]
  }));
}

function pointOn(s: Segment, t: number): Vec {
  const u = 1 - t;
  return add(add(times(s[0], u * u * u), times(s[1], 3 * u * u * t)), add(times(s[2], 3 * u * t * t), times(s[3], t * t * t)));
}

function arcTable(s: Segment): number[] {
  const lengths = [0];
  for (let i = 1; i <= ARC_STEPS; i++) {
    lengths.push(lengths[i - 1] + length(sub(pointOn(s, i / ARC_STEPS), pointOn(s, (i - 1) / ARC_STEPS))));
  }
  return lengths;
}

function tAtLength(table: number[], distance: number): number {
  const reached = table.findIndex((l) => l >= distance);
  if (reached < 0) {
    return 1;
  }
  const i = Math.max(0, reached - 1);
  const span = table[i + 1] - table[i];
  return (i + (span > 0 ? (distance - table[i]) / span : 0)) / ARC_STEPS;
}

export function pathAt(clip: PathClip, frame: number, size: Size): PathSample | null {
  if (!clip.path || pathProblem(clip)) {
    return null;
  }
  const segs = segments(clip, keyPoints(clip, size), size);
  const tables = segs.map(arcTable);
  const reach = tables.reduce<number[]>((acc, table) => [...acc, acc[acc.length - 1] + table[ARC_STEPS]], [0]);
  const timing = clip.keyframes.x!.map((k, i) => ({ ...k, value: reach[i] }));
  const travelled = Math.min(Math.max(sampleTrack(timing, frame), 0), reach[reach.length - 1]);

  let index = 0;
  while (index < segs.length - 1 && reach[index + 1] < travelled) {
    index++;
  }
  const t = tAtLength(tables[index], travelled - reach[index]);
  const point = pointOn(segs[index], t);
  const ahead = pointOn(segs[index], Math.min(1, t + TANGENT_EPSILON));
  const behind = pointOn(segs[index], Math.max(0, t - TANGENT_EPSILON));
  const heading = sub(ahead, behind);
  return { x: point[0] / size.width, y: point[1] / size.height, z: point[2], angle: Math.atan2(heading[1], heading[0]) * DEGREES };
}

function dense(first: number, last: number, value: (frame: number) => number): Keyframe[] {
  return Array.from({ length: last - first + 1 }, (_, i) => ({ frame: first + i, value: value(first + i), ease: Ease.Linear }));
}

export function bakePath<C extends PathClip>(clip: C, size: Size): C {
  if (!clip.path || pathProblem(clip)) {
    return { ...clip, path: null };
  }
  const x = clip.keyframes.x!;
  const first = x[0].frame;
  const last = x[x.length - 1].frame;
  const at = (f: number) => pathAt(clip, f, size)!;
  const keyframes: Keyframes = { ...clip.keyframes, x: dense(first, last, (f) => at(f).x), y: dense(first, last, (f) => at(f).y) };
  if (clip.keyframes.z?.length) {
    keyframes.z = dense(first, last, (f) => at(f).z);
  }
  if (clip.path.autoOrient) {
    const base = (f: number) => (clip.keyframes.rotateZ?.length ? sampleTrack(clip.keyframes.rotateZ, f) : (clip.transform.rotateZ ?? 0));
    keyframes.rotateZ = dense(first, last, (f) => base(f) + at(f).angle);
  }
  return { ...clip, keyframes, path: null };
}

export function bakePaths<D extends { width: number; height: number; tracks: { clips: PathClip[] }[] }>(doc: D): D {
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.path ? bakePath(c, doc) : c)) })) };
}
