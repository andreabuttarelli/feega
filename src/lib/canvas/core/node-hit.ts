import { labelBoxes, type ChromeTile, type Glyphs } from './chrome';
import type { Rect } from '$lib/canvas/gpu/camera';

export const nodeHitRects = (t: ChromeTile, glyphs: Glyphs): Rect[] => [{ id: t.id, x: t.x, y: t.y, w: t.width, h: t.height }, ...labelBoxes(t, glyphs).map((b) => ({ id: t.id, ...b }))];
