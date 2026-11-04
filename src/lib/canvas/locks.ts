import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ownClipOf } from './frame-select';

function lockedUp(doc: MotionDoc, id: string): boolean {
  const seen = new Set<string>();
  for (let at: string | null | undefined = id; at && !seen.has(at); at = findClip(doc, at)?.clip.parent) {
    seen.add(at);
    if (findClip(doc, at)?.clip.locked) {
      return true;
    }
  }
  return false;
}

export const holdsLock = (doc: MotionDoc, ids: readonly string[]): boolean => ids.some((id) => lockedUp(doc, id));

export function ownLocked(doc: MotionDoc): boolean {
  const own = ownClipOf(doc);
  return own ? holdsLock(doc, [own]) : false;
}
