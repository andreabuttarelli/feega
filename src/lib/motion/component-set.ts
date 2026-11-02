import type { MotionClip, MotionComp, MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { appendVariant } from './variants';
import { compBox, reframed, type Box } from './comp-frame';
import type { NewId } from './main-component';

export const SET_GAP_PX = 20;
export const SET_PAD_PX = 20;
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

type Size = { width: number; height: number };

function stretched(comp: MotionComp, doc: MotionDoc, box: Box, to: Size): MotionComp {
  const sx = to.width / (box.right - box.left);
  const sy = to.height / (box.bottom - box.top);
  const clips = comp.tracks.flatMap((t) => t.clips as MotionClip[]);
  const byId = new Map(clips.map((c) => [c.id, c]));
  const placed = (clip: MotionClip) => typeof clip.props.x === 'number' && !(clip.parent && byId.get(clip.parent));
  const along = (value: number, side: number, from: number, scale: number) => (from + (value * side - from) * scale) / side;
  const sized = (clip: MotionClip): MotionClip =>
    placed(clip)
      ? {
          ...clip,
          props: {
            ...clip.props,
            x: along(Number(clip.props.x), doc.width, box.left, sx),
            y: along(Number(clip.props.y), doc.height, box.top, sy),
            width: Number(clip.props.width) * sx,
            height: Number(clip.props.height) * sy
          }
        }
      : clip;
  return { ...comp, tracks: comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(sized) })) };
}

export function resizeSetMain(doc: MotionDoc, clipId: string, size: Size): OpResult {
  const clip = topClips(doc).find((c) => c.id === clipId && ownMain(doc, c));
  const compId = clip ? String(clip.props.comp) : '';
  const box = clip ? compBox(doc.comps[compId], doc) : null;
  if (!box) {
    return fail('pick a main of this component set');
  }

  const mains = topClips(doc).flatMap((c) => (ownMain(doc, c) ? [String(c.props.comp)] : []));
  const boxes = new Map(mains.map((id) => [id, compBox(doc.comps[id], doc)]));
  const grow = size.width - (box.right - box.left);
  const bottoms = [...boxes].map(([id, b]) => (id === compId ? box.top + size.height : (b?.bottom ?? 0)));
  const bottom = Math.max(...[...boxes.values()].map((b) => b?.bottom ?? 0));
  const next = { width: Math.ceil(doc.width + grow), height: Math.ceil(doc.height + Math.max(...bottoms) - bottom) };

  const after = (id: string) => (boxes.get(id)?.left ?? 0) > box.left;
  const placedComp = (id: string, comp: MotionComp) => {
    if (id === compId) {
      return reframed(stretched(comp, doc, box, size), doc, next);
    }
    return reframed(comp, doc, next, after(id) ? { x: grow, y: 0 } : { x: 0, y: 0 });
  };
  const comps = Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, placedComp(id, comp)]));
  return { ok: true, doc: { ...doc, ...next, comps } };
}
