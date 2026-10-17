import { motionOf, posterFresh } from '../motion-node';

export const SHELF_CAP = 2;

type Row = { id: string; type: string; data: Record<string, unknown> };

function needsPoster(row: Row): boolean {
  const motion = motionOf(row);
  return !!motion && (!motion.posterAssetId || !posterFresh(motion));
}

export function shelfIds(rows: Row[], mounted: Set<string>): string[] {
  return rows
    .filter((r) => !mounted.has(r.id) && needsPoster(r))
    .slice(0, SHELF_CAP)
    .map((r) => r.id);
}
