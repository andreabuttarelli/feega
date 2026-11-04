import { wrapAngle, type Placed, type Turn } from './node-layout';

type Box = { x: number; y: number; w: number; h: number };

export type PlacedChange = { before: Placed; after: Placed };

export type ManyPlan = {
  turns: Turn[];
  resizes: { id: string; before: Box; after: Box }[];
  moves: { id: string; x: number; y: number }[];
};

const boxOf = (p: Placed): Box => ({ x: p.x, y: p.y, w: p.w, h: p.h });
const sized = (c: PlacedChange) => c.before.w !== c.after.w || c.before.h !== c.after.h;
const moved = (c: PlacedChange) => c.before.x !== c.after.x || c.before.y !== c.after.y;
const turnOf = (c: PlacedChange) => wrapAngle(c.after.rotation - c.before.rotation);

export function planPlaceMany(changes: readonly PlacedChange[]): ManyPlan {
  return {
    turns: changes.filter((c) => turnOf(c) !== 0).map((c) => ({ id: c.after.id, degrees: turnOf(c) })),
    resizes: changes.filter(sized).map((c) => ({ id: c.after.id, before: boxOf(c.before), after: boxOf(c.after) })),
    moves: changes.filter((c) => !sized(c) && moved(c)).map((c) => ({ id: c.after.id, x: c.after.x, y: c.after.y }))
  };
}

export async function reverseEach<T>(steps: readonly T[], reverse: (step: T) => Promise<T | null>): Promise<T[]> {
  const back: T[] = [];
  for (const step of [...steps].reverse()) {
    const done = await reverse(step);
    if (done !== null) {
      back.push(done);
    }
  }
  return back;
}
