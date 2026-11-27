import type { Bounds } from './canvas-layout';

export type CanvasView = { scale: number; x: number; y: number };

export type Point = { x: number; y: number };

export type Viewport = { w: number; h: number };

export const CANVAS_MIN_ZOOM = 0.02;
export const CANVAS_MAX_ZOOM = 4;
const FIT_MAX_ZOOM = 1;
const FIT_PADDING = 80;
const STEP_RATIO = 1.25;
const WHEEL_SPEED = 0.01;
const REAL_SIZE = 1;

const clampScale = (scale: number) => Math.min(Math.max(scale, CANVAS_MIN_ZOOM), CANVAS_MAX_ZOOM);

export function setScale(view: CanvasView, scale: number, at: Point): CanvasView {
  const next = clampScale(scale);
  const ratio = next / view.scale;

  return { scale: next, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio };
}

export const zoomAround = (view: CanvasView, factor: number, at: Point): CanvasView => setScale(view, view.scale * factor, at);

export const centreOf = (viewport: Viewport): Point => ({ x: viewport.w / 2, y: viewport.h / 2 });

export const stepView = (view: CanvasView, direction: 1 | -1, viewport: Viewport): CanvasView => zoomAround(view, direction === 1 ? STEP_RATIO : 1 / STEP_RATIO, centreOf(viewport));

export const actualView = (view: CanvasView, viewport: Viewport): CanvasView => setScale(view, REAL_SIZE, centreOf(viewport));

export const panBy = (view: CanvasView, dx: number, dy: number): CanvasView => ({ ...view, x: view.x + dx, y: view.y + dy });

export function fitView(bounds: Bounds, viewport: Viewport): CanvasView {
  if (bounds.width === 0 || bounds.height === 0) {
    return { scale: 1, x: 0, y: 0 };
  }
  const room = { w: Math.max(viewport.w - 2 * FIT_PADDING, 1), h: Math.max(viewport.h - 2 * FIT_PADDING, 1) };
  const scale = Math.min(FIT_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, Math.min(room.w / bounds.width, room.h / bounds.height)));

  return { scale, x: (viewport.w - bounds.width * scale) / 2 - bounds.x * scale, y: (viewport.h - bounds.height * scale) / 2 - bounds.y * scale };
}

type Wheel = { deltaX: number; deltaY: number; ctrlKey: boolean; metaKey: boolean };

export type WheelAction = { kind: 'zoom'; factor: number } | { kind: 'pan'; dx: number; dy: number };

export function wheelOf(e: Wheel): WheelAction {
  if (e.ctrlKey || e.metaKey) {
    return { kind: 'zoom', factor: Math.exp(-e.deltaY * WHEEL_SPEED) };
  }

  return { kind: 'pan', dx: -e.deltaX, dy: -e.deltaY };
}

export const percentOf = (scale: number): string => `${Math.round(scale * 100)}%`;

export enum CanvasKey {
  In = 'in',
  Out = 'out',
  Fit = 'fit',
  Actual = 'actual',
  Close = 'close'
}

type Press = { key: string; code?: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean };

const PLAIN: Record<string, CanvasKey> = {
  Equal: CanvasKey.In,
  NumpadAdd: CanvasKey.In,
  Minus: CanvasKey.Out,
  NumpadSubtract: CanvasKey.Out,
  Digit0: CanvasKey.Fit,
  Numpad0: CanvasKey.Fit,
  Escape: CanvasKey.Close
};

const SHIFTED: Record<string, CanvasKey> = {
  Equal: CanvasKey.In,
  Digit0: CanvasKey.Actual,
  Digit1: CanvasKey.Fit
};

export function canvasKeyOf(e: Press): CanvasKey | null {
  const table = e.shiftKey ? SHIFTED : PLAIN;

  return table[e.code ?? ''] ?? null;
}
