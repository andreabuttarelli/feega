export const VIEWPORT_MARGIN = 8;
export const TOOLBAR_GAP = 10;

type Box = { x: number; y: number; width: number };
type Size = { width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  return max < min ? min : Math.min(max, Math.max(min, value));
}

export function clampCentre(centre: number, width: number, viewportWidth: number): number {
  const half = width / 2;
  return clamp(centre, half + VIEWPORT_MARGIN, viewportWidth - half - VIEWPORT_MARGIN);
}

export function toolbarAnchor(box: Box, toolbar: Size, viewport: Size): { x: number; y: number } {
  return {
    x: clampCentre(box.x + box.width / 2, toolbar.width, viewport.width),
    y: Math.max(box.y, toolbar.height + TOOLBAR_GAP + VIEWPORT_MARGIN)
  };
}
