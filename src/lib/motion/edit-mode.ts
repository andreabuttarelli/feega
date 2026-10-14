import type { MotionClip, MotionDoc } from './doc';
import { editAt, valueAt } from './inspector';
import { withParams } from './custom/params';
import type { KeyValue } from './keyframes';
import { setKeyframes, type OpResult } from './timeline';

export enum EditMode {
  Design = 'design',
  Motion = 'motion'
}

export const EDIT_MODE_KEY = 'feega.frame-edit-mode';


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

const NEXT: Record<EditMode, EditMode> = { [EditMode.Design]: EditMode.Motion, [EditMode.Motion]: EditMode.Design };

export const nextMode = (mode: EditMode): EditMode => NEXT[mode];

export const readMode = (stored: string | null): EditMode => (Object.values(EditMode) as string[]).includes(stored ?? '') ? (stored as EditMode) : EditMode.Motion;
