import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';

export type ElementTurn = { doc: MotionDoc; degrees: number };

const rootsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => !c.parent);

export function elementTurn(doc: MotionDoc): ElementTurn | null {
  const [root, ...rest] = rootsOf(doc);
  const degrees = root?.transform.rotateZ ?? 0;
  if (!root || rest.length || !degrees || root.keyframes.rotateZ?.length) {
    return null;
  }
  const upright = { ...root, transform: { ...root.transform, rotateZ: 0 } };
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === root.id ? upright : c)) }));
  return { doc: { ...doc, tracks } as MotionDoc, degrees };
}
