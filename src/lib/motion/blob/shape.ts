import { bounds, deformOf, dropsOf, inverseOf, strainAlong, type Deform, type Drop, type Strain, type Vec } from './geometry';
import { MAX_DROPS, type BlobNumberKey } from './model';

export const FLAT = 0.55;
export const DEPTH = 0.55;
const SPEED_STRAIN = 0.025;
const PUSH_STRAIN = 0.0009;
const MAX_TARGET = 0.55;
const BASE_WOBBLE = 0.035;
const MOTION_WOBBLE = 0.22;
const SHADOW_REACH = 0.7;
const PRECISION = 1000;

export type BlobValues = Record<BlobNumberKey, number>;
export type BlobSize = { width: number; height: number; fps: number };

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

export const radiusOf = (v: BlobValues, at: BlobSize) => (v.diameter * Math.min(at.width, at.height)) / 2;
export const centreOf = (v: BlobValues, at: BlobSize): Vec => ({ x: v.centerX * at.width, y: v.centerY * at.height });

export type CentrePath = { before: Vec; here: Vec; after: Vec; seconds: number };

export function strainTarget(path: CentrePath, radius: number, stretch: number): Strain {
  const { before, here, after, seconds } = path;
  const r = Math.max(radius, 1);
  const v = { x: (after.x - before.x) / 2 / seconds, y: (after.y - before.y) / 2 / seconds };
  const a = { x: (after.x - 2 * here.x + before.x) / (seconds * seconds), y: (after.y - 2 * here.y + before.y) / (seconds * seconds) };
  const speed = (Math.hypot(v.x, v.y) / r) * SPEED_STRAIN;
  const push = (Math.hypot(a.x, a.y) / r) * PUSH_STRAIN;
  const moving = strainAlong(v, speed);
  const squash = strainAlong(a, -push);
  const p = (moving.p + squash.p) * stretch;
  const q = (moving.q + squash.q) * stretch;
  const size = Math.hypot(p, q);
  const k = size > MAX_TARGET ? MAX_TARGET / size : 1;
  return { p: p * k, q: q * k };
}

export function blobShape(v: BlobValues, tint: string, strain: Strain, at: BlobSize): BlobPose {
  const r = radiusOf(v, at);
  const center = centreOf(v, at);
  const drops = dropsOf(center, r, Math.min(v.drops, MAX_DROPS), v.split * Math.min(at.width, at.height), v.splitAngle);
  const warp = deformOf(strain);
  const reach = Math.hypot(strain.p, strain.q);
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
