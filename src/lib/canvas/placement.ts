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

const RING_LIMIT = 12;

export function placeNear(centre: { x: number; y: number }, size: { w: number; h: number }, occupied: Rect[]): { x: number; y: number } {
  const origin = { x: centre.x - size.w / 2, y: centre.y - size.h / 2 };
  const step = { x: size.w + PLACEMENT_GAP, y: size.h + PLACEMENT_GAP };

  for (let ring = 0; ring <= RING_LIMIT; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
          continue;
        }
        const spot: Rect = { x: origin.x + dx * step.x, y: origin.y + dy * step.y, ...size };
        if (!occupied.some((o) => overlaps(spot, o))) {
          return { x: spot.x, y: spot.y };
        }
      }
    }
  }
  return origin;
}
