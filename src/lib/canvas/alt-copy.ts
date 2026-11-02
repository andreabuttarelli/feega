import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { duplicateLayer } from '$lib/motion/layout/ops';

export type Copied = { doc: MotionDoc; ids: string[] };

export function altCopies(doc: MotionDoc, ids: readonly string[], newId: () => string): Copied | null {
  let next = doc;
  const copies: string[] = [];
  for (const id of ids) {
    const copy = newId();
    const made = duplicateLayer(next, id, copy);
    if (!made.ok) {
      return null;
    }
    next = made.doc;
    copies.push(copy);
  }
  return { doc: next, ids: copies };
}
