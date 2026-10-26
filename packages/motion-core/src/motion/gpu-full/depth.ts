import { apply2d } from '../affine';
import { invert2d, pivotOf, transformAt, mul2d, type Affine } from '../parent';
import type { MotionClip } from '../doc';
import { TRANSFORM, type TransformKey } from '../keyframes';
import { flattened, mul4, projectBy, translate4, viewOf, type Matrix4 } from './dom/css';

const DEG = Math.PI / 180;

const DEPTH_KEYS: readonly TransformKey[] = ['z', 'rotateX', 'rotateY', 'skewX', 'skewY'];

type Size = { width: number; height: number };

type Box = { left: number; top: number; width: number; height: number };

export type Depth = { world: Affine; warp: (p: [number, number]) => [number, number] };

const lift = (m: Affine): Matrix4 => [m[0], m[1], 0, 0, m[2], m[3], 0, 0, 0, 0, 1, 0, m[4], m[5], 0, 1];

const rotateX = (deg: number): Matrix4 => {
  const [c, s] = [Math.cos(deg * DEG), Math.sin(deg * DEG)];
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
};

const rotateY = (deg: number): Matrix4 => {
  const [c, s] = [Math.cos(deg * DEG), Math.sin(deg * DEG)];
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
};

const rotateZ = (deg: number): Matrix4 => {
  const [c, s] = [Math.cos(deg * DEG), Math.sin(deg * DEG)];
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
};

const skew = (x: number, y: number): Matrix4 => [1, Math.tan(y * DEG), 0, 0, Math.tan(x * DEG), 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const scale = (x: number, y: number): Matrix4 => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const translate3 = (x: number, y: number, z: number): Matrix4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

const about = ([ox, oy]: [number, number], m: Matrix4) => mul4(mul4(translate4(ox, oy), m), translate4(-ox, -oy));

export const turnedInDepth = (clip: MotionClip) => DEPTH_KEYS.some((k) => (clip.transform[k] ?? TRANSFORM[k].fallback) !== TRANSFORM[k].fallback || (clip.keyframes[k]?.length ?? 0) > 0);

function ownChain(clip: MotionClip, frame: number, size: Size): Matrix4 {
  const at = (key: TransformKey) => transformAt(clip, key, frame);
  const origin = pivotOf(clip, size);
  const turned = [translate3(at('x') * size.width, at('y') * size.height, at('z')), rotateZ(at('rotateZ')), rotateY(at('rotateY')), rotateX(at('rotateX')), skew(at('skewX'), at('skewY')), scale(at('scaleX'), at('scaleY'))].reduce(mul4);
  const own = mul4(about(origin, turned), about(origin, scale(at('scale'), at('scale'))));
  const depth = at('perspective');
  return depth > 0 ? mul4(viewOf({ depth, origin }), own) : own;
}

export function depthOf(clip: MotionClip, frame: number, size: Size, outer: Affine, box: Box): Depth | null {
  const chain = mul4(lift(outer), ownChain(clip, frame, size));
  const fitted = flattened(mul4(chain, translate4(box.left, box.top)), { w: box.width, h: box.height });
  if (!fitted) {
    return null;
  }
  const world = mul2d(fitted, [1, 0, 0, 1, -box.left, -box.top]);
  const back = invert2d(world);
  const project = projectBy(chain);
  return { world, warp: (p) => project(apply2d(back, p)) ?? p };
}
