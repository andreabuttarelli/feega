import type { CanvasFrame } from './canvas-layout';
import type { Size } from './sizes';

export type CanvasOpen = { route: string; size: Size };

export const openOf = (frame: CanvasFrame): CanvasOpen | null => (frame.dynamic ? null : { route: frame.route, size: frame.size });
