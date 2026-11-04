import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { duplicateInPlace } from '$lib/motion/duplicate-in-place';

export type Copied = { doc: MotionDoc; ids: string[] };

export function altCopies(doc: MotionDoc, ids: readonly string[], newId: () => string, here: string | null = null): Copied | null {
  let next = doc;
  const copies: string[] = [];
  for (const id of ids) {
    const made = duplicateInPlace(next, id, newId, here);
    if (!made.ok) {
      return null;
    }
    next = made.doc;
    copies.push(made.id);
  }
  return { doc: next, ids: copies };
}
