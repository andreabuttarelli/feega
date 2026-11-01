import { FIT_PADDING, READABLE_ZOOM } from './placement';
import type { Viewport } from './dot-grid';

type Bounds = { x: number; y: number; width: number; height: number };
type Screen = { width: number; height: number };

const MIN_ZOOM = 0.05;
const HALF = 2;

const isUsable = (v: Viewport) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.zoom) && v.zoom > 0;

function showsContent(view: Viewport, content: Bounds, screen: Screen): boolean {
  const left = -view.x / view.zoom;
  const top = -view.y / view.zoom;
  const right = left + screen.width / view.zoom;
  const bottom = top + screen.height / view.zoom;

  return left < content.x + content.width && content.x < right && top < content.y + content.height && content.y < bottom;
}

export const FIT_MAX_ZOOM = 4;

export enum FitPurpose {
  Open = 'open',
  Command = 'command'
}

const FIT_CAP: Record<FitPurpose, number> = {
  [FitPurpose.Open]: READABLE_ZOOM,
  [FitPurpose.Command]: FIT_MAX_ZOOM
};

export function fitView(content: Bounds, screen: Screen, purpose: FitPurpose): Viewport {
  const room = 1 + FIT_PADDING;
  const wanted = Math.min(screen.width / (content.width * room), screen.height / (content.height * room));
  const zoom = Math.max(MIN_ZOOM, Math.min(FIT_CAP[purpose], wanted));

  return {
    x: screen.width / HALF - (content.x + content.width / HALF) * zoom,
    y: screen.height / HALF - (content.y + content.height / HALF) * zoom,
    zoom
  };
}

export function restoreViewport(saved: Viewport | null, content: Bounds | null, screen: Screen): Viewport {
  if (!content) {
    return { x: screen.width / HALF, y: screen.height / HALF, zoom: READABLE_ZOOM };
  }

  if (saved && isUsable(saved) && showsContent(saved, content, screen)) {
    return saved;
  }

  return fitView({ ...content, width: Math.max(content.width, 1), height: Math.max(content.height, 1) }, screen, FitPurpose.Open);
}
