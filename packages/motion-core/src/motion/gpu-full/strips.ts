import { FullBackend } from './backends';

export const STRIP_PX = 2048;

export type Strip = { top: number; height: number };

const DRAWS_FROM_AN_ORIGIN: Record<FullBackend, boolean> = {
  [FullBackend.WebGl2]: false,
  [FullBackend.Core]: true,
  [FullBackend.CoreGl]: true
};

export function stripsFor(backend: FullBackend, size: { width: number; height: number }): Strip[] {
  if (!DRAWS_FROM_AN_ORIGIN[backend]) {
    return [{ top: 0, height: size.height }];
  }

  const strips: Strip[] = [];
  for (let top = 0; top < size.height; top += STRIP_PX) {
    strips.push({ top, height: Math.min(STRIP_PX, size.height - top) });
  }
  return strips;
}
