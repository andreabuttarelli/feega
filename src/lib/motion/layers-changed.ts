import type { MotionDoc } from '@feega/motion-core/motion/doc';

type Layered = { tracks?: { clips?: { id: string }[] }[] } | null | undefined;

const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const layersOf = (doc: Layered): Map<string, string> =>
  new Map(listOf<{ clips?: unknown }>(doc?.tracks).flatMap((t) => listOf<{ id: string }>(t?.clips).map((c) => [String(c?.id), JSON.stringify(c)] as const)));

export function layersChanged(before: MotionDoc | null | undefined, after: MotionDoc): number {
  const was = layersOf(before as Layered);
  const now = layersOf(after as Layered);
  const added = [...now].filter(([id, body]) => was.get(id) !== body).length;
  const removed = [...was.keys()].filter((id) => !now.has(id)).length;
  const touched = added + removed;
  if (touched) {
    return touched;
  }
  return JSON.stringify(before ?? null) === JSON.stringify(after) ? 0 : 1;
}
