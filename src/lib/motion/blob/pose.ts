import { sampleColor, sampleTrack, type Keyframe } from '../keyframes';
import { bounds, deformOf, dropsOf, inverseOf, jellyOf, jellyStrains, strainAlong, type Deform, type Drop, type Strain, type Vec } from './geometry';
import { BLOB_NUMBERS, BLOB_NUMBER_KEYS, BLOB_TINT, MAX_DROPS, type BlobNumberKey } from './model';

export const FLAT = 0.55;
export const DEPTH = 0.55;
const SPEED_STRAIN = 0.025;
const PUSH_STRAIN = 0.0009;
const MAX_TARGET = 0.55;
const BASE_WOBBLE = 0.035;
const MOTION_WOBBLE = 0.22;
const SHADOW_REACH = 0.7;
const PRECISION = 1000;

export type BlobClip = { props: Record<string, unknown>; keyframes: Record<string, Keyframe[] | undefined>; durationInFrames: number };
export type BlobFrame = { width: number; height: number; fps: number };

export type BlobPose = {
  center: Vec;
  drops: Drop[];
  unwarp: Deform;
  blend: number;
  wobble: number;
  wobbleSpeed: number;
  ior: number;
  dispersion: number;
  frost: number;
  reflection: number;
  tint: string;
  tintAmount: number;
  presence: number;
  box: { x: number; y: number; width: number; height: number };
};

type Values = Record<BlobNumberKey, number>;

const valueAt = (clip: BlobClip, key: BlobNumberKey, frame: number) => {
  const track = clip.keyframes[key];
  return track?.length ? sampleTrack(track, frame) : Number(clip.props[key] ?? BLOB_NUMBERS[key].fallback);
};

const valuesAt = (clip: BlobClip, frame: number) => Object.fromEntries(BLOB_NUMBER_KEYS.map((key) => [key, valueAt(clip, key, frame)])) as Values;

const radiusOf = (v: Values, at: BlobFrame) => (v.diameter * Math.min(at.width, at.height)) / 2;
const centreOf = (v: Values, at: BlobFrame): Vec => ({ x: v.centerX * at.width, y: v.centerY * at.height });

function targetStrain(clip: BlobClip, frame: number, at: BlobFrame): Strain {
  const now = valuesAt(clip, frame);
  const before = centreOf(valuesAt(clip, frame - 1), at);
  const after = centreOf(valuesAt(clip, frame + 1), at);
  const here = centreOf(now, at);
  const r = Math.max(radiusOf(now, at), 1);
  const v = { x: ((after.x - before.x) / 2) * at.fps, y: ((after.y - before.y) / 2) * at.fps };
  const a = { x: (after.x - 2 * here.x + before.x) * at.fps * at.fps, y: (after.y - 2 * here.y + before.y) * at.fps * at.fps };
  const speed = (Math.hypot(v.x, v.y) / r) * SPEED_STRAIN;
  const push = (Math.hypot(a.x, a.y) / r) * PUSH_STRAIN;
  const stretch = strainAlong(v, speed);
  const squash = strainAlong(a, -push);
  const p = (stretch.p + squash.p) * now.stretch;
  const q = (stretch.q + squash.q) * now.stretch;
  const size = Math.hypot(p, q);
  const k = size > MAX_TARGET ? MAX_TARGET / size : 1;
  return { p: p * k, q: q * k };
}

export function blobStrains(clip: BlobClip, at: BlobFrame): Strain[] {
  const frames = Array.from({ length: clip.durationInFrames + 1 }, (_, f) => f);
  const targets = frames.map((f) => targetStrain(clip, f, at));
  const jellies = frames.map((f) => jellyOf(valueAt(clip, 'viscosity', f)));
  return jellyStrains(targets, jellies, at.fps);
}

export function blobPose(clip: BlobClip, frame: number, strain: Strain, at: BlobFrame, resolve: (v: string) => string): BlobPose {
  const v = valuesAt(clip, frame);
  const r = radiusOf(v, at);
  const center = centreOf(v, at);
  const drops = dropsOf(center, r, Math.min(v.drops, MAX_DROPS), v.split * Math.min(at.width, at.height), v.splitAngle);
  const warp = deformOf(strain);
  const reach = Math.hypot(strain.p, strain.q);
  const track = clip.keyframes[BLOB_TINT.key];
  const tint = track?.length ? sampleColor(track, frame, resolve) : resolve(String(clip.props[BLOB_TINT.key] ?? BLOB_TINT.fallback));
  const wobble = drops[0].r * v.wobble * (BASE_WOBBLE + MOTION_WOBBLE * reach);
  return {
    center,
    drops,
    unwarp: inverseOf(warp),
    blend: Math.max(v.blend * drops[0].r, 1),
    wobble,
    wobbleSpeed: v.wobbleSpeed,
    ior: v.ior,
    dispersion: v.dispersion,
    frost: v.frost,
    reflection: v.reflection,
    tint,
    tintAmount: v.tintAmount,
    presence: v.presence,
    box: bounds(drops, warp, center, r * SHADOW_REACH + wobble * 2)
  };
}

const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

function rgb(color: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) {
    return [1, 1, 1];
  }
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

export const ROW = { center: 0, blend: 2, wobble: 3, drops: 4, unwarp: 4 + MAX_DROPS * 3, ior: 7 + MAX_DROPS * 3, dispersion: 8 + MAX_DROPS * 3, frost: 9 + MAX_DROPS * 3, reflection: 10 + MAX_DROPS * 3, tintAmount: 11 + MAX_DROPS * 3, presence: 12 + MAX_DROPS * 3, tint: 13 + MAX_DROPS * 3, wobbleSpeed: 16 + MAX_DROPS * 3, box: 17 + MAX_DROPS * 3 } as const;
export const ROW_LENGTH = ROW.box + 4;

export function poseRow(p: BlobPose): number[] {
  const drops = Array.from({ length: MAX_DROPS }, (_, i) => p.drops[i] ?? { x: 0, y: 0, r: 0 }).flatMap((d) => [d.x, d.y, d.r]);
  return [p.center.x, p.center.y, p.blend, p.wobble, ...drops, p.unwarp.xx, p.unwarp.xy, p.unwarp.yy, p.ior, p.dispersion, p.frost, p.reflection, p.tintAmount, p.presence, ...rgb(p.tint), p.wobbleSpeed, p.box.x, p.box.y, p.box.width, p.box.height].map(round);
}

export function blobRows(clip: BlobClip, at: BlobFrame, resolve: (v: string) => string): number[][] {
  const strains = blobStrains(clip, at);
  return strains.map((strain, frame) => poseRow(blobPose(clip, frame, strain, at, resolve)));
}
