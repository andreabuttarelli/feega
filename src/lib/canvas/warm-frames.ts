export const WARM_MAX = 6;

type Rect = { x: number; y: number; w: number; h: number };
export type WarmCandidate = Rect & { id: string; version: number };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const centreOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function framesToWarm(frames: WarmCandidate[], view: Rect, warmed: ReadonlyMap<string, number>): string[] {
  const middle = centreOf(view);
  const away = (r: Rect) => Math.hypot(centreOf(r).x - middle.x, centreOf(r).y - middle.y);

  return frames
    .filter((f) => overlaps(f, view))
    .sort((a, b) => away(a) - away(b))
    .slice(0, WARM_MAX)
    .filter((f) => warmed.get(f.id) !== f.version)
    .map((f) => f.id);
}
