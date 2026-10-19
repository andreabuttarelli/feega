import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import type { Camera } from '$lib/motion/gpu-full/raster';

const SOFT_ZOOM = 1.4;

export enum Restage {
  No = 'no',
  WhenIdle = 'when-idle',
  Now = 'now'
}

export function cameraFrom(staged: Viewport, now: Viewport, resolution: number): Camera {
  const s = now.zoom / staged.zoom;
  return [s, 0, 0, s, (now.x - staged.x * s) * resolution, (now.y - staged.y * s) * resolution];
}

export function restageFor(staged: Viewport, now: Viewport, screen: Screen, reach: number): Restage {
  const s = now.zoom / staged.zoom;
  const [, , , , tx, ty] = cameraFrom(staged, now, 1);
  const shrinks = s < 1 && (screen.width / s - screen.width) / 2 > reach;
  if (s > SOFT_ZOOM || s < 1 / SOFT_ZOOM || shrinks || Math.abs(tx) > reach || Math.abs(ty) > reach) {
    return Restage.Now;
  }
  return s === 1 ? Restage.No : Restage.WhenIdle;
}
