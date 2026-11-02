import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setKeyframes, setProps, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';

export enum Flip {
  Horizontal = 'horizontal',
  Vertical = 'vertical'
}

type Scales = { scaleX?: number; scaleY?: number };

const AXIS: Record<Flip, keyof Scales> = {
  [Flip.Horizontal]: 'scaleX',
  [Flip.Vertical]: 'scaleY'
};

export function flipPatch(scales: Scales, flip: Flip): Scales {
  const key = AXIS[flip];
  return { [key]: -(scales[key] ?? 1) };
}

const SPAN: Record<Flip, { anchor: 'anchorX' | 'anchorY'; at: 'x' | 'y'; size: 'width' | 'height' }> = {
  [Flip.Horizontal]: { anchor: 'anchorX', at: 'x', size: 'width' },
  [Flip.Vertical]: { anchor: 'anchorY', at: 'y', size: 'height' }
};

const MIDDLE = 0.5;

function centredPivot(doc: MotionDoc, clip: MotionClip, flip: Flip): OpResult {
  const { anchor, at, size } = SPAN[flip];
  const [place, length] = [clip.props[at], clip.props[size]];
  if (typeof place !== 'number' || typeof length !== 'number' || clip.transform.rotateZ) {
    return { ok: true, doc };
  }
  const pivot = clip.transform[anchor] ?? MIDDLE;
  const scale = clip.transform[AXIS[flip]] ?? 1;
  const moved = setProps(doc, clip.id, { [at]: place + (scale - 1) * (MIDDLE - pivot) * length });
  return moved.ok ? setTransform(moved.doc, clip.id, { [anchor]: MIDDLE }) : moved;
}

function flipOne(doc: MotionDoc, clipId: string, flip: Flip): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  const key = AXIS[flip];
  const track = clip.keyframes[key];
  if (track?.length) {
    return setKeyframes(doc, clipId, key, track.map((k) => ({ ...k, value: -Number(k.value) })));
  }
  const centred = centredPivot(doc, clip, flip);
  return centred.ok ? setTransform(centred.doc, clipId, flipPatch(clip.transform, flip)) : centred;
}

export const QUARTER_TURN = 90;

export function turnClips(doc: MotionDoc, ids: readonly string[], degrees: number): OpResult {
  const turnOne = (at: MotionDoc, id: string): OpResult => {
    const clip = findClip(at, id)?.clip;
    if (!clip) {
      return { ok: false, error: `no clip ${id}` };
    }
    const track = clip.keyframes.rotateZ;
    if (track?.length) {
      return setKeyframes(at, id, 'rotateZ', track.map((k) => ({ ...k, value: Number(k.value) + degrees })));
    }
    return setTransform(at, id, { rotateZ: (clip.transform.rotateZ ?? 0) + degrees });
  };
  return ids.reduce<OpResult>((r, id) => (r.ok ? turnOne(r.doc, id) : r), { ok: true, doc });
}

export function flipClips(doc: MotionDoc, ids: readonly string[], flip: Flip): OpResult {
  return ids.reduce<OpResult>((r, id) => (r.ok ? flipOne(r.doc, id, flip) : r), { ok: true, doc });
}
