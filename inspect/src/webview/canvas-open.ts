import type { CanvasFrame } from './canvas-layout';
import type { Size } from './sizes';

export type CanvasOpen = { route: string; size: Size };

export const openOf = (frame: CanvasFrame): CanvasOpen | null => (frame.target === null ? null : { route: frame.target, size: frame.size });

export type Hit = { label: string; title: string; enabled: boolean };
