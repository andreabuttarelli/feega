export enum Stack {
  Front = 'front',
  Back = 'back'
}

export type Layer = { id: string; z: number };

export function restacked(layers: readonly Layer[], ids: readonly string[], to: Stack): Layer[] {
  const picked = new Set(ids);
  const moving = layers.filter((l) => picked.has(l.id)).sort((a, b) => a.z - b.z);
  if (!moving.length) {
    return [];
  }

  const zs = layers.map((l) => l.z);
  const start = to === Stack.Front ? Math.max(...zs) + 1 : Math.min(...zs) - moving.length;
  return moving.map((l, i) => ({ id: l.id, z: start + i }));
}

export function stackedLocally<T extends { id: string }>(tiles: readonly T[], ids: readonly string[], to: Stack): T[] {
  const picked = new Set(ids);
  const moving = tiles.filter((t) => picked.has(t.id));
  const staying = tiles.filter((t) => !picked.has(t.id));
  return to === Stack.Front ? [...staying, ...moving] : [...moving, ...staying];
}
