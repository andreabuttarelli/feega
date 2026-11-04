export enum Stack {
  Front = 'front',
  Back = 'back',
  Forward = 'forward',
  Backward = 'backward'
}

export type Layer = { id: string; z: number };

type Step = Stack.Forward | Stack.Backward;

function stepped<T extends { id: string }>(items: readonly T[], picked: ReadonlySet<string>, to: Step): T[] {
  const out = [...items];
  const forward = to === Stack.Forward;
  const indices = out.map((_, i) => i);
  for (const i of forward ? indices.reverse() : indices) {
    const j = forward ? i + 1 : i - 1;
    if (!picked.has(out[i].id) || j < 0 || j >= out.length || picked.has(out[j].id)) {
      continue;
    }
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function ends(layers: readonly Layer[], ids: readonly string[], to: Stack.Front | Stack.Back): Layer[] {
  const picked = new Set(ids);
  const moving = layers.filter((l) => picked.has(l.id)).sort((a, b) => a.z - b.z);
  if (!moving.length) {
    return [];
  }

  const zs = layers.map((l) => l.z);
  const start = to === Stack.Front ? Math.max(...zs) + 1 : Math.min(...zs) - moving.length;
  return moving.map((l, i) => ({ id: l.id, z: start + i }));
}

function steps(layers: readonly Layer[], ids: readonly string[], to: Step): Layer[] {
  const sorted = [...layers].sort((a, b) => a.z - b.z);
  const order = stepped(sorted, new Set(ids), to);
  const was = new Map(layers.map((l) => [l.id, l.z]));
  const placed: Layer[] = [];
  order.forEach((l, i) => placed.push({ id: l.id, z: i === 0 ? sorted[0].z : Math.max(placed[i - 1].z + 1, sorted[i].z) }));
  return placed.filter((l) => was.get(l.id) !== l.z);
}

const RESTACK: Record<Stack, (layers: readonly Layer[], ids: readonly string[]) => Layer[]> = {
  [Stack.Front]: (layers, ids) => ends(layers, ids, Stack.Front),
  [Stack.Back]: (layers, ids) => ends(layers, ids, Stack.Back),
  [Stack.Forward]: (layers, ids) => steps(layers, ids, Stack.Forward),
  [Stack.Backward]: (layers, ids) => steps(layers, ids, Stack.Backward)
};

export const restacked = (layers: readonly Layer[], ids: readonly string[], to: Stack): Layer[] => RESTACK[to](layers, ids);

type Reorder = <T extends { id: string }>(tiles: readonly T[], picked: ReadonlySet<string>) => T[];

const LOCAL: Record<Stack, Reorder> = {
  [Stack.Front]: (tiles, picked) => [...tiles.filter((t) => !picked.has(t.id)), ...tiles.filter((t) => picked.has(t.id))],
  [Stack.Back]: (tiles, picked) => [...tiles.filter((t) => picked.has(t.id)), ...tiles.filter((t) => !picked.has(t.id))],
  [Stack.Forward]: (tiles, picked) => stepped(tiles, picked, Stack.Forward),
  [Stack.Backward]: (tiles, picked) => stepped(tiles, picked, Stack.Backward)
};

export const stackedLocally = <T extends { id: string }>(tiles: readonly T[], ids: readonly string[], to: Stack): T[] => LOCAL[to](tiles, new Set(ids));
