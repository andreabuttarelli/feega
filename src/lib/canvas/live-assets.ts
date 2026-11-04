import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { mentionedIds } from '$lib/motion/doc-assets';

export function missingAssets(doc: MotionDoc, known: Record<string, string>, urlOf: (id: string) => string): Record<string, string> | null {
  const missing = mentionedIds(doc).filter((id) => !known[id]);
  if (!missing.length) {
    return null;
  }

  return Object.fromEntries(missing.map((id) => [id, urlOf(id)]));
}
