import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen as ScreenSize } from '$lib/canvas/gpu/camera';
import type { Screen, Use } from '$lib/motion/gpu-full/core-web';
import type { Rgba } from '$lib/motion/gpu-full/rgba';
import type { Box } from './canvas-scene';

export type PutFrame = { id: string; group: string; box: Box; size: { width: number; height: number } };

const USE = 'use';

const onScreen = (view: Viewport, b: Box, screen: ScreenSize) => {
  const x0 = view.x + b.x * view.zoom;
  const y0 = view.y + b.y * view.zoom;
  return x0 + b.w * view.zoom >= 0 && y0 + b.h * view.zoom >= 0 && x0 <= screen.width && y0 <= screen.height;
};

function useOf(f: PutFrame, view: Viewport): Use {
  const sx = (f.box.w * view.zoom) / f.size.width;
  const sy = (f.box.h * view.zoom) / f.size.height;
  return { kind: USE, clip: f.id, group: f.group, matrix: [sx, 0, 0, sy, view.x + f.box.x * view.zoom, view.y + f.box.y * view.zoom] };
}

export function screenUses(frames: readonly PutFrame[], view: Viewport, screen: ScreenSize, background: Rgba | null): Screen {
  return { width: screen.width, height: screen.height, background, items: frames.filter((f) => onScreen(view, f.box, screen)).map((f) => useOf(f, view)) };
}
