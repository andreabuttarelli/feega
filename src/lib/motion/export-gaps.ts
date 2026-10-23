import { BlendMode } from './blend';
import type { Item } from './gpu-full/display-list';

export function commonGap(item: Item): string | null {
  if (item.blend !== BlendMode.Normal) {
    return `blend mode ${item.blend}`;
  }
  if (item.filters?.length || item.space || item.backdrop) {
    return 'effects';
  }
  if (item.matte) {
    return 'matte';
  }
  return null;
}
