import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { editAt, valueAt } from './inspector';
import { withParams } from '@feega/motion-core/motion/custom/params';
import type { KeyValue } from '@feega/motion-core/motion/keyframes';
import { setKeyframes, type OpResult } from '@feega/motion-core/motion/timeline';
import { VideoControl, controlShown } from '@feega/motion-core/motion/still';
import { timelineFits } from '@feega/motion-core/motion/editor-mount';

export enum EditMode {
  Design = 'design',
  Motion = 'motion'
}

const animated = (clip: MotionClip, key: string) => Boolean(clip.keyframes[key]?.length);

const sameColor = (color: string) => color;

function shiftAnimation(doc: MotionDoc, clip: MotionClip, key: string, value: KeyValue, frame: number): OpResult {
  const now = valueAt(withParams(doc, clip), key, frame, sameColor);
  const delta = typeof value === 'number' && typeof now === 'number' ? value - now : null;
  const track = clip.keyframes[key].map((k) => ({ ...k, value: delta !== null && typeof k.value === 'number' ? k.value + delta : value }));
  return setKeyframes(doc, clip.id, key, track);
}

const EDIT: Record<EditMode, (doc: MotionDoc, clip: MotionClip, key: string, value: KeyValue, frame: number) => OpResult> = {
  [EditMode.Motion]: editAt,
  [EditMode.Design]: (doc, clip, key, value, frame) => (animated(clip, key) ? shiftAnimation(doc, clip, key, value, frame) : editAt(doc, clip, key, value, frame))
};

export const editIn = (mode: EditMode, doc: MotionDoc, clip: MotionClip, key: string, value: KeyValue, frame: number): OpResult => EDIT[mode](doc, clip, key, value, frame);

export function designWarning(mode: EditMode, clip: MotionClip): string | null {
  const keys = Object.keys(clip.keyframes).filter((key) => animated(clip, key));
  if (mode !== EditMode.Design || !keys.length) {
    return null;
  }
  return `Animated: ${keys.join(', ')}. Design moves every keyframe by your change; Motion keys it at the playhead.`;
}

export const readMode = (stored: string | null): EditMode => (Object.values(EditMode) as string[]).includes(stored ?? '') ? (stored as EditMode) : EditMode.Design;

export function startMode(doc: MotionDoc, stored: string | null): EditMode {
  return controlShown(doc, VideoControl.EditMode) && timelineFits(doc) ? readMode(stored) : EditMode.Design;
}

export const MODE_LABEL: Record<EditMode, string> = { [EditMode.Design]: 'Design: edits set the resting state', [EditMode.Motion]: 'Animate: edits key at the playhead' };

export const timelineShown = (kindHasTimeline: boolean, mode: EditMode): boolean => kindHasTimeline && mode === EditMode.Motion;

export const modeSwitchShown = (doc: MotionDoc): boolean => controlShown(doc, VideoControl.EditMode) && timelineFits(doc);
