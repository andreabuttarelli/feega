import type { MotionClip, MotionDoc } from '../doc';
import { withContentHeight, withFittedInstances } from '../layout/resolve';
import { resolveAt } from './model';

function withHiddenSubtrees(doc: MotionDoc): MotionDoc {
  const byId = new Map(doc.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  const hiddenUp = (id: string | null | undefined): boolean => {
    const clip = id ? byId.get(id) : undefined;
    return !!clip && (!!clip.hidden || hiddenUp(clip.parent));
  };
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (!c.hidden && hiddenUp(c.parent) ? { ...c, hidden: true } : c)) })) as MotionDoc['tracks'] };
}

export const resolveView = (doc: MotionDoc, breakpointId: string): MotionDoc => withContentHeight(withFittedInstances(withHiddenSubtrees(resolveAt(doc, breakpointId))));
