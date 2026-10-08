import { clampZoom } from './timeline-view';

export enum Axis {
  Horizontal = 'horizontal',
  Vertical = 'vertical'
}

const AXIS_LOCK_PX = 8;

export type PinchStart = { zoom: number; scrollLeft: number; mid: number; distance: number };
export type PinchNow = { mid: number; distance: number };
export type TimelineView = { zoom: number; scrollLeft: number };

export function pinchView(start: PinchStart, now: PinchNow): TimelineView {
  const zoom = clampZoom((start.zoom * now.distance) / Math.max(1, start.distance));
  const anchored = ((start.scrollLeft + start.mid) * zoom) / start.zoom;
  return { zoom, scrollLeft: Math.max(0, anchored - now.mid) };
}

export function lockAxis(dx: number, dy: number): Axis | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) {
    return null;
  }
  return Math.abs(dx) > Math.abs(dy) ? Axis.Horizontal : Axis.Vertical;
}
