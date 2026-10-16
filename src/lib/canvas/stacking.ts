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
