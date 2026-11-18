export const GRID_FADE_FROM = 6;
export const GRID_FULL_AT = 8;
export const GRID_ALPHA = 0.35;
export const GRID_COLOUR = '128, 128, 128';

export const gridFade = (zoom: number): number => Math.min(1, Math.max(0, (zoom - GRID_FADE_FROM) / (GRID_FULL_AT - GRID_FADE_FROM)));

export const gridAlpha = (zoom: number): number => GRID_ALPHA * gridFade(zoom);

export function gridStops(offset: number, zoom: number, length: number): number[] {
  if (gridFade(zoom) === 0) {
    return [];
  }

  const first = Math.ceil(-offset / zoom);
  const last = Math.floor((length - offset) / zoom);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => offset + (first + i) * zoom);
}
