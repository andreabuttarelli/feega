import type { MotionDoc } from '@feega/motion-core/motion/doc';

type Entry = readonly [string, string];

const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const recordOf = (value: unknown): [string, Record<string, unknown>][] =>
  value && typeof value === 'object' && !Array.isArray(value) ? (Object.entries(value) as [string, Record<string, unknown>][]) : [];

const clipsIn = (scope: string, tracks: unknown): Entry[] =>
  listOf<{ clips?: unknown }>(tracks).flatMap((t) => listOf<{ id?: unknown }>(t?.clips).map((c) => [`${scope}:clip:${String(c?.id)}`, JSON.stringify(c)] as const));

const compsIn = (comps: unknown): Entry[] =>
  recordOf(comps).flatMap(([name, comp]) => {
    const { tracks, ...shell } = comp ?? {};
    return [[`comp:${name}`, JSON.stringify(shell)] as const, ...clipsIn(`comp:${name}`, tracks)];
  });

const LAYER_CONTAINERS: readonly ((doc: Record<string, unknown>) => Entry[])[] = [
  (doc) => clipsIn('root', doc.tracks),
  (doc) => compsIn(doc.comps),
  (doc) => recordOf(doc.components).map(([name, component]) => [`component:${name}`, JSON.stringify(component)] as const),
  (doc) => listOf<{ id?: unknown }>(doc.breakpoints).map((view) => [`view:${String(view?.id)}`, JSON.stringify(view)] as const)
];

const layersOf = (doc: unknown): Map<string, string> => {
  const record = (doc && typeof doc === 'object' ? doc : {}) as Record<string, unknown>;
  return new Map(LAYER_CONTAINERS.flatMap((entries) => entries(record)));
};

export function layersChanged(before: MotionDoc | null | undefined, after: MotionDoc): number {
  const was = layersOf(before);
  const now = layersOf(after);
  const added = [...now].filter(([id, body]) => was.get(id) !== body).length;
  const removed = [...was.keys()].filter((id) => !now.has(id)).length;
  const touched = added + removed;
  if (touched) {
    return touched;
  }
  return JSON.stringify(before ?? null) === JSON.stringify(after) ? 0 : 1;
}
