import { Ease } from '@feega/motion-core/motion/design';
import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { valueAt } from './inspector';
import { withParams } from '@feega/motion-core/motion/custom/params';
import { animProp, type EaseSpec, type KeyValue, type Keyframe, type TransformKey } from '@feega/motion-core/motion/keyframes';
import { setKeyframes, type OpResult } from '@feega/motion-core/motion/timeline';

export const ANIMATE_TO_KEYS = ['opacity', 'x', 'y', 'scale', 'rotateZ', 'blur'] as const satisfies readonly TransformKey[];

export type AnimateSpan = { start: number; duration: number; ease?: EaseSpec };

const fail = (error: string): OpResult => ({ ok: false, error });

export function spliced(track: readonly Keyframe[], from: Keyframe, to: Keyframe): Keyframe[] {
  const outside = track.filter((k) => k.frame < from.frame || k.frame > to.frame);
  return [...outside, from, to].sort((a, b) => a.frame - b.frame);
}

export function animateTo(doc: MotionDoc, clipId: string, targets: Record<string, KeyValue>, span: AnimateSpan, resolve: (color: string) => string): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  const { clip } = found;
  const withDefs = withParams(doc, clip);
  const start = Math.max(0, Math.round(span.start));
  const end = start + Math.max(1, Math.round(span.duration));
  let result: OpResult = { ok: true, doc };

  for (const [key, target] of Object.entries(targets)) {
    if (!animProp(clip.component, key, withDefs.params)) {
      return fail(`${clip.component} cannot animate ${key}`);
    }
    const now = valueAt(withDefs, key, clip.from + start, resolve);
    if (now === null || !result.ok) {
      return fail(`${clip.component} cannot animate ${key}`);
    }
    const track = findClip(result.doc, clipId)!.clip.keyframes[key] ?? [];
    result = setKeyframes(result.doc, clipId, key, spliced(track, { frame: start, value: now, ease: span.ease ?? Ease.Standard }, { frame: end, value: target, ease: Ease.Standard }));
  }
  return result;
}
