import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { appendVariant } from './variants';
import { compBox, reframed } from './comp-frame';
import type { NewId } from './main-component';

export const SET_GAP_PX = 48;
export const SET_BACKDROP = 'Background';

const fail = (error: string): OpResult => ({ ok: false, error });

const topClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => !c.parent);

const ownMain = (doc: MotionDoc, clip: MotionClip) => {
  const comp = clip.component === 'Precomp' ? doc.comps[String(clip.props.comp)] : undefined;
  return Boolean(comp?.component && !comp.component.home);
};

export function setMainOf(doc: MotionDoc): string | null {
  const clips = topClips(doc);
  const mains = clips.filter((c) => ownMain(doc, c));
  const loose = clips.some((c) => !ownMain(doc, c) && c.name !== SET_BACKDROP);
  return mains.length && !loose ? String(mains.at(-1)!.props.comp) : null;
}

export function addSetVariant(doc: MotionDoc, newId: NewId): OpResult {
  const main = setMainOf(doc);
  if (!main) {
    return fail('this frame is not a component set');
  }

  const variantId = newId();
  const added = appendVariant(doc, main, () => variantId);
  if (!added.ok) {
    return added;
  }

  const boxes = topClips(doc).flatMap((c) => (ownMain(doc, c) ? [compBox(doc.comps[String(c.props.comp)], doc)] : [])).filter((b) => b !== null);
  const box = compBox(doc.comps[main], doc);
  if (!box) {
    return fail('the main has no size');
  }

  const size = { width: Math.ceil(doc.width + box.right - box.left + SET_GAP_PX), height: doc.height };
  const right = Math.max(...boxes.map((b) => b.right));
  const comps = Object.fromEntries(Object.entries(added.doc.comps).map(([id, comp]) => [id, id === variantId ? reframed(comp, doc, size, { x: right + SET_GAP_PX - box.left, y: 0 }) : reframed(comp, doc, size)]));
  return addClip({ ...added.doc, ...size, comps }, { component: 'Precomp', from: 0, durationInFrames: Math.min(comps[variantId].durationInFrames, doc.durationInFrames), props: { comp: variantId } }, newId());
}
