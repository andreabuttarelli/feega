import type { DisplayList } from '$lib/motion/gpu-full/display-list';

export const PART_ITEMS = 32;

export function parts(list: DisplayList, size: number): DisplayList[] {
  const count = Math.max(1, Math.ceil(list.items.length / size));
  return Array.from({ length: count }, (_, i) => ({ ...list, items: list.items.slice(i * size, (i + 1) * size) }));
}
