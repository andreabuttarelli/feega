import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import type { Style } from '@feega/motion-core/motion/styles-model';
import { SLOTS, currentOf, sameValue, stylePatch } from './styles';

function linkedStyles(doc: MotionDoc, clip: MotionClip): Style[] {
  return SLOTS.flatMap((slot) => {
    const name = clip[slot];
    const style = name ? doc.styles?.[name] : undefined;
    return style ? [style] : [];
  });
}

function governed(doc: MotionDoc, clip: MotionClip): Record<string, unknown> {
  return Object.assign({}, ...linkedStyles(doc, clip).map((style) => stylePatch(clip, style)));
}

export function overridesOf(doc: MotionDoc, clipId: string): string[] {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return [];
  }
  return Object.entries(governed(doc, clip))
    .filter(([key, value]) => !sameValue(currentOf(clip, key), value))
    .map(([key]) => key);
}

export function resetOverride(doc: MotionDoc, clipId: string, key: string): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  const patch = clip ? governed(doc, clip) : {};
  if (!clip || !(key in patch)) {
    return { ok: false, error: `${clipId} has no style governing ${key}` };
  }
  return setProps(doc, clipId, { [key]: patch[key] });
}
