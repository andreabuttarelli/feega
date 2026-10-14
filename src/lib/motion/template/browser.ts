export enum Dismiss {
  Detail = 'detail',
  Library = 'library'
}

export const dismissFrom = (openId: string | null): Dismiss => (openId ? Dismiss.Detail : Dismiss.Library);

export type Rect = { x: number; y: number; width: number; height: number };

const DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  ArrowRight: { dx: 1, dy: 0 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowUp: { dx: 0, dy: -1 }
};

const ENDS: Record<string, (count: number) => number> = {
  Home: () => 0,
  End: (count) => count - 1
};

const ACROSS_WEIGHT = 3;

const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

export function spatialStep(rects: readonly Rect[], at: number, key: string): number | null {
  const end = ENDS[key];
  if (end) {
    return end(rects.length);
  }
  const d = DIRECTIONS[key];
  if (!d) {
    return null;
  }

  const from = centre(rects[at]);
  const reach = (Math.abs(d.dx) * rects[at].width + Math.abs(d.dy) * rects[at].height) / 2;
  let best = at;
  let bestScore = Infinity;
  rects.forEach((r, i) => {
    const c = centre(r);
    const along = (c.x - from.x) * d.dx + (c.y - from.y) * d.dy;
    if (along <= reach) {
      return;
    }
    const across = Math.abs((c.x - from.x) * d.dy) + Math.abs((c.y - from.y) * d.dx);
    const score = along + ACROSS_WEIGHT * across;
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}
