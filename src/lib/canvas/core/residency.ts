import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import type { PutFrame } from './screen-uses';
import { textured } from './texture-budget';

export type HeldFrame = PutFrame & { images: number };

const RGBA_BYTES = 4;

const bytesOf = (f: HeldFrame) => f.images * f.size.width * f.size.height * RGBA_BYTES;

export function resident(frames: readonly HeldFrame[], view: Viewport, screen: Screen, budget: number): HeldFrame[] {
  const media = new Set(textured(frames.map((f) => ({ id: f.id, ...f.box, bytes: bytesOf(f) })), view, screen, budget));
  return frames.filter((f) => f.images === 0 || media.has(f.id));
}
