import type { Use } from '$lib/motion/gpu-full/core-web';
import type { Box } from './canvas-scene';
import { mul2d, type Affine } from '$lib/motion/affine';

const DEG = Math.PI / 180;

export type Turn = { degrees: number; about: { x: number; y: number } };

export type PutFrame = { id: string; group: string; box: Box; size: { width: number; height: number }; turn?: Turn; cache?: boolean; hold?: boolean };

const USE = 'use';

export const AHEAD_REACH = 1;

export function turned(t: Turn | undefined): Affine {
  if (!t) {
    return [1, 0, 0, 1, 0, 0];
  }
  const c = Math.cos(t.degrees * DEG);
  const n = Math.sin(t.degrees * DEG);
  return [c, n, -n, c, t.about.x - c * t.about.x + n * t.about.y, t.about.y - n * t.about.x - c * t.about.y];
}

function useOf(f: PutFrame): Use {
  const place: Affine = [f.box.w / f.size.width, 0, 0, f.box.h / f.size.height, f.box.x, f.box.y];
  const use: Use = { kind: USE, clip: f.id, group: f.group, matrix: mul2d(turned(f.turn), place) };
  return f.cache ? { ...use, cache: true, ...(f.hold ? { hold: true } : {}) } : use;
}

export function worldUses(frames: readonly PutFrame[]): Use[] {
  return frames.map(useOf);
}
