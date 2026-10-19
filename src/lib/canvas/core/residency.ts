import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import { ItemKind, type Item } from '$lib/motion/gpu-full/display-list';
import type { PutFrame } from './screen-uses';
import { textured } from './texture-budget';

export type HeldFrame = PutFrame & { bytes: number };

const RGBA_BYTES = 4;

export const pictureBytes = (items: readonly Item[]): number => items.reduce((sum, i) => sum + (i.kind === ItemKind.Image ? i.size.width * i.size.height * RGBA_BYTES : 0), 0);

export function resident(frames: readonly HeldFrame[], view: Viewport, screen: Screen, budget: number): HeldFrame[] {
  const media = new Set(textured(frames.map((f) => ({ id: f.id, ...f.box, bytes: f.bytes })), view, screen, budget));
  return frames.filter((f) => f.bytes === 0 || media.has(f.id));
}
