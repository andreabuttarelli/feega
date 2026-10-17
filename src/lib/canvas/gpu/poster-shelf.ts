import { motionOf, posterFresh } from '../motion-node';

export const SHELF_CAP = 2;
export const STUCK_MS = 20_000;
export const RETRY_MS = 60_000;

type Row = { id: string; type: string; data: Record<string, unknown> };

function needsPoster(row: Row): boolean {
  const motion = motionOf(row);
  return !!motion && (!motion.posterAssetId || !posterFresh(motion));
}

export function shelfIds(rows: Row[], mounted: Set<string>, parked: Map<string, number>, now: number): string[] {
  return rows
    .filter((r) => !mounted.has(r.id) && (parked.get(r.id) ?? 0) <= now && needsPoster(r))
    .slice(0, SHELF_CAP)
    .map((r) => r.id);
}

export function parkStuck(since: Map<string, number>, parked: Map<string, number>, now: number): Map<string, number> {
  const next = new Map(parked);
  for (const [id, at] of since) {
    if (now - at >= STUCK_MS) {
      next.set(id, now + RETRY_MS);
    }
  }
  return next;
}
