import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { boxAround, hasBox, wrapInGroup } from './layout/ops';
import { setParent } from './parent-ops';
import { removeClips, type OpResult } from '@feega/motion-core/motion/timeline';

const fail = (error: string): OpResult => ({ ok: false, error });

export const groupLight = wrapInGroup;

const allClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

const membersOf = (doc: MotionDoc, groupId: string) => allClips(doc).filter((c) => c.parent === groupId && hasBox(c));

export function ungroupLight(doc: MotionDoc, groupId: string): OpResult {
  const group = findClip(doc, groupId)?.clip;
  if (!group?.group) {
    return fail(`${groupId} is not a group`);
  }

  let result: OpResult = { ok: true, doc };
  for (const member of allClips(doc).filter((c) => c.parent === groupId)) {
    result = result.ok ? setParent(result.doc, member.id, null) : result;
  }
  return result.ok ? removeClips(result.doc, [groupId]) : result;
}

export function settleGroups(doc: MotionDoc): MotionDoc {
  const groups = allClips(doc).filter((c) => c.group);
  if (!groups.length) {
    return doc;
  }

  const empty = groups.filter((g) => !membersOf(doc, g.id).length).map((g) => g.id);
  const kept = empty.length ? removeClips(doc, empty) : { ok: true as const, doc };
  const base = kept.ok ? kept.doc : doc;
  const fitted = new Map(groups.filter((g) => !empty.includes(g.id)).map((g) => [g.id, boxAround(base, membersOf(base, g.id))]));
  const same = (g: MotionClip, box: ReturnType<typeof boxAround>) => (['x', 'y', 'width', 'height'] as const).every((k) => g.props[k] === box[k]);
  const moved = [...fitted].some(([id, box]) => !same(findClip(base, id)!.clip, box));
  if (!moved) {
    return base;
  }
  return { ...base, tracks: base.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (fitted.has(c.id) ? { ...c, props: { ...c.props, ...fitted.get(c.id) } } : c)) })) };
}
