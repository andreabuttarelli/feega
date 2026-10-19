import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen as ScreenSize } from '$lib/canvas/gpu/camera';
import type { Screen, Use } from '$lib/motion/gpu-full/core-web';
import type { Rgba } from '$lib/motion/gpu-full/rgba';
import type { Box } from './canvas-scene';
import { mul2d, type Affine } from '$lib/motion/affine';

const DEG = Math.PI / 180;

export type Turn = { degrees: number; about: { x: number; y: number } };

export type PutFrame = { id: string; group: string; box: Box; size: { width: number; height: number }; turn?: Turn; cache?: boolean };

const USE = 'use';

const NO_REACH = 0;

const near = (view: Viewport, b: Box, screen: ScreenSize, reach: number) => {
  const x0 = view.x + b.x * view.zoom;
  const y0 = view.y + b.y * view.zoom;
  const [rx, ry] = [screen.width * reach, screen.height * reach];
  return x0 + b.w * view.zoom >= -rx && y0 + b.h * view.zoom >= -ry && x0 <= screen.width + rx && y0 <= screen.height + ry;
};

export const AHEAD_REACH = 1;

export function turned(t: Turn | undefined): Affine {
  if (!t) {
    return [1, 0, 0, 1, 0, 0];
  }
  const c = Math.cos(t.degrees * DEG);
  const n = Math.sin(t.degrees * DEG);
  return [c, n, -n, c, t.about.x - c * t.about.x + n * t.about.y, t.about.y - n * t.about.x - c * t.about.y];
}

function useOf(f: PutFrame, view: Viewport): Use {
  const place: Affine = [f.box.w / f.size.width, 0, 0, f.box.h / f.size.height, f.box.x, f.box.y];
  const camera: Affine = [view.zoom, 0, 0, view.zoom, view.x, view.y];
  const use: Use = { kind: USE, clip: f.id, group: f.group, matrix: mul2d(camera, mul2d(turned(f.turn), place)) };
  return f.cache ? { ...use, cache: true } : use;
}

export function screenUses(frames: readonly PutFrame[], view: Viewport, screen: ScreenSize, background: Rgba | null): Screen {
  return { width: screen.width, height: screen.height, background, items: frames.filter((f) => near(view, f.box, screen, f.cache ? AHEAD_REACH : NO_REACH)).map((f) => useOf(f, view)) };
}
