import { cloneDoc, findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { childrenInOrder } from '@feega/motion-core/motion/layout/resolve';
import { ComponentRole, instanceOf, roleOf, withSubtrees, type NewId } from './main-component';
import { appendVariant } from './variants';
import { layoutParent, reorderChild } from './layout/ops';

export type Duplicated = { ok: true; doc: MotionDoc; id: string } | { ok: false; error: string };

function newMain(doc: MotionDoc, compId: string, newId: NewId): { doc: MotionDoc; compId: string } {
  const main = doc.comps[compId];
  const id = newId();
  if (main.component?.set || main.component?.variant) {
    const added = appendVariant(doc, compId, () => id);
    return added.ok ? { doc: added.doc, compId: id } : { doc, compId };
  }
  const copy = { ...cloneDoc(main), component: { name: main.component!.name, ...(main.component!.properties ? { properties: main.component!.properties } : {}) } };
  return { doc: { ...doc, comps: { ...doc.comps, [id]: copy } }, compId: id };
}

function rootComp(doc: MotionDoc, clipId: string, here: string | null, newId: NewId): { doc: MotionDoc; compId: string | null } {
  const instance = instanceOf(doc, clipId);
  if (!instance || roleOf(doc, clipId, here) !== ComponentRole.Main) {
    return { doc, compId: null };
  }
  return newMain(doc, instance.compId, newId);
}

export function duplicateInPlace(doc: MotionDoc, clipId: string, newId: NewId, here: string | null): Duplicated {
  const found = findClip(doc, clipId);
  if (!found) {
    return { ok: false, error: `no clip ${clipId}` };
  }

  const ids = withSubtrees(doc, [clipId]);
  const renamed = new Map(ids.map((id) => [id, newId()]));
  const rename = (id: string) => renamed.get(id) ?? id;
  const main = rootComp(doc, clipId, here, newId);

  const copyOf = (clip: MotionClip): MotionClip => {
    const copy = { ...cloneDoc(clip), id: rename(clip.id), parent: clip.id === clipId ? clip.parent : rename(clip.parent ?? '') || null };
    const laid = copy.autoLayout ? { ...copy, autoLayout: { ...copy.autoLayout, order: copy.autoLayout.order.map(rename) } } : copy;
    return clip.id === clipId && main.compId ? { ...laid, props: { ...laid.props, comp: main.compId } } : laid;
  };

  const tracks = main.doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).flatMap((c) => (renamed.has(c.id) ? [c, copyOf(c)] : [c])) }));
  const added = { ...main.doc, tracks };
  const id = rename(clipId);
  const parent = layoutParent(added, findClip(added, id)!.clip as MotionClip);
  if (!parent) {
    return { ok: true, doc: added, id };
  }
  const order = childrenInOrder(tracks.flatMap((t) => t.clips), parent).map((c) => c.id);
  const placed = reorderChild(added, parent.id, id, order.indexOf(clipId) + 1);
  return placed.ok ? { ok: true, doc: placed.doc, id } : placed;
}
