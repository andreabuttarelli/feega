import type { ComponentId } from '@feega/motion-core/motion/components';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { removeClips, type OpResult } from '@feega/motion-core/motion/timeline';

const RIGS: ReadonlySet<ComponentId> = new Set(['Null']);

const allClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

function withContents(clips: readonly MotionClip[], ids: readonly string[]): string[] {
  const rigs = new Set(clips.filter((c) => RIGS.has(c.component)).map((c) => c.id));
  const taken = new Set(ids);
  let grew = true;
  while (grew) {
    const held = clips.filter((c) => c.parent && taken.has(c.parent) && !rigs.has(c.parent) && !taken.has(c.id));
    held.forEach((c) => taken.add(c.id));
    grew = held.length > 0;
  }
  return [...taken];
}

export const removeLayers = (doc: MotionDoc, ids: readonly string[]): OpResult => removeClips(doc, withContents(allClips(doc), ids));
