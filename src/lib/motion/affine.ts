export type Pose2d = { x: number; y: number; rotateZ: number; scaleX: number; scaleY: number };

const DEG = Math.PI / 180;

export type Affine = [number, number, number, number, number, number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export function apply2d(m: Affine, [x, y]: [number, number]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function mul2d(a: Affine, b: Affine): Affine {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

export function composeLocal(pose: Pose2d, [ox, oy]: [number, number]): Affine {
  const c = Math.cos(pose.rotateZ * DEG);
  const s = Math.sin(pose.rotateZ * DEG);
  const linear: Affine = [c * pose.scaleX, s * pose.scaleX, -s * pose.scaleY, c * pose.scaleY, 0, 0];
  const [lx, ly] = apply2d(linear, [ox, oy]);
  return [linear[0], linear[1], linear[2], linear[3], ox + pose.x - lx, oy + pose.y - ly];
}
