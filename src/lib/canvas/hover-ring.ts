import type { Viewport } from './dot-grid';
import { HOVER_SCREEN_PX, strokeWorld } from './core/label-size';

const GAP_SCREEN_PX = 1;

export type RingBox = { x: number; y: number; w: number; h: number; rotation?: number; radius?: number };

export function hoverRingStyle(view: Viewport, b: RingBox): string {
  const line = strokeWorld(HOVER_SCREEN_PX, view.zoom) * view.zoom;
  const out = GAP_SCREEN_PX + line;
  const radius = b.radius ? `;border-radius:${b.radius * view.zoom + out}px` : '';
  const turn = b.rotation ? `;rotate:${b.rotation}deg` : '';
  return `left:${view.x + b.x * view.zoom - out}px;top:${view.y + b.y * view.zoom - out}px;width:${b.w * view.zoom + 2 * out}px;height:${b.h * view.zoom + 2 * out}px;border-width:${line}px${radius}${turn}`;
}
