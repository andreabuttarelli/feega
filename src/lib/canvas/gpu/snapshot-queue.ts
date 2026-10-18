type Tile = { id: string; w: number; h: number; x?: number; y?: number };
type Point = { x: number; y: number };

const LIVE_FIELDS = new Set(['running', 'status', 'run_id', 'started_at', 'finished_at', 'cost_usd']);

export const isRunning = (data: Record<string, unknown>) => data.running === true || data.status === 'running';

export function snapshotKey<T extends Tile>(t: T, data: Record<string, unknown>, thumbs: readonly string[]): string {
  const still = Object.fromEntries(Object.entries(data).filter(([k]) => !LIVE_FIELDS.has(k)));
  return JSON.stringify([Math.round(t.w), Math.round(t.h), still, thumbs]);
}

const distance = (t: Tile, p: Point) => Math.hypot((t.x ?? 0) + t.w / 2 - p.x, (t.y ?? 0) + t.h / 2 - p.y);

export function nextSnapshot(tiles: readonly Tile[], keyOf: (id: string) => string, pictured: ReadonlyMap<string, string>, visible: ReadonlySet<string>, live: ReadonlySet<string>, centre?: Point): string | null {
  const due = tiles.filter((t) => !live.has(t.id) && pictured.get(t.id) !== keyOf(t.id));
  const seen = due.filter((t) => visible.has(t.id));
  const pool = seen.length ? seen : due;
  if (!pool.length) {
    return null;
  }
  if (!centre) {
    return pool[0].id;
  }
  return pool.reduce((best, t) => (distance(t, centre) < distance(best, centre) ? t : best)).id;
}
