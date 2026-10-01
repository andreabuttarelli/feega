export const PLACEMENT_GAP = 80;

export const READABLE_ZOOM = 1;

export const FIT_PADDING = 0.2;

export type Rect = { x: number; y: number; w: number; h: number };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function placeBeside(sources: Rect[], size: { w: number; h: number }, occupied: Rect[]): { x: number; y: number } {
  const right = Math.max(...sources.map((s) => s.x + s.w));
  const spot: Rect = { x: right + PLACEMENT_GAP, y: sources[0].y, ...size };

  for (;;) {
    const blocker = occupied.find((o) => overlaps(spot, o));
    if (!blocker) {
      return { x: spot.x, y: spot.y };
    }
    spot.y = blocker.y + blocker.h + PLACEMENT_GAP;
  }
}
