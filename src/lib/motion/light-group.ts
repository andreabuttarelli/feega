import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
import { pivotBox } from '@feega/motion-core/motion/parent';
import type { Box } from '@feega/motion-core/motion/layout';
import { boxAround, hasBox, layoutParent, reordered, wrapInGroup } from './layout/ops';
import { setParent } from './parent-ops';
import { removeClips, setProps, type OpResult } from '@feega/motion-core/motion/timeline';

const fail = (error: string): OpResult => ({ ok: false, error });

export const groupLight = wrapInGroup;

const allClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

const membersOf = (doc: MotionDoc, groupId: string) => allClips(doc).filter((c) => c.parent === groupId && hasBox(c));

const FLOW_FIRST: Record<Direction, (a: Box, b: Box) => number> = {
  [Direction.Horizontal]: (a, b) => a.left - b.left || a.top - b.top,
  [Direction.Vertical]: (a, b) => a.top - b.top || a.left - b.left,
  [Direction.Grid]: (a, b) => a.top - b.top || a.left - b.left
};

function inFlowOrder(doc: MotionDoc, members: readonly MotionClip[], direction: Direction): string[] {
  const boxOf = (c: MotionClip) => pivotBox(c.props, doc);
  return [...members].sort((a, b) => FLOW_FIRST[direction](boxOf(a), boxOf(b))).map((c) => c.id);
}

export function ungroupLight(doc: MotionDoc, groupId: string): OpResult {
  const group = findClip(doc, groupId)?.clip;
  if (!group?.group) {
    return fail(`${groupId} is not a group`);
  }

  const host = group.parent ?? null;
  const members = allClips(doc).filter((c) => c.parent === groupId);
  let result: OpResult = { ok: true, doc };
  for (const member of members) {
    result = result.ok ? setParent(result.doc, member.id, host) : result;
  }

  const stack = layoutParent(doc, group);
  result = result.ok && stack ? reordered(result.doc, host, groupId, inFlowOrder(doc, members, stack.autoLayout.direction)) : result;
  return result.ok ? removeClips(result.doc, [groupId]) : result;
}

const GEOMETRY = ['x', 'y', 'width', 'height'] as const;

type Geometry = Partial<Record<(typeof GEOMETRY)[number], number>>;

function descendantsOf(doc: MotionDoc, id: string): MotionClip[] {
  const children = allClips(doc).filter((c) => c.parent === id);
  return children.flatMap((c) => [c, ...descendantsOf(doc, c.id)]);
}

function regrouped(doc: MotionDoc, group: MotionClip, patch: Geometry): MotionDoc {
  const from = { x: Number(group.props.x), y: Number(group.props.y), width: Number(group.props.width), height: Number(group.props.height) };
  const width = patch.width ?? from.width;
  const height = patch.height ?? from.height;
  const to = { width, height, x: patch.x ?? from.x - from.width / 2 + width / 2, y: patch.y ?? from.y - from.height / 2 + height / 2 };
  const sx = from.width ? to.width / from.width : 1;
  const sy = from.height ? to.height / from.height : 1;
  const moved = new Set(descendantsOf(doc, group.id).filter(hasBox).map((c) => c.id));

  const mapped = (c: MotionClip): MotionClip => {
    if (!moved.has(c.id)) {
      return c;
    }
    const x = to.x + (Number(c.props.x) - from.x) * sx;
    const y = to.y + (Number(c.props.y) - from.y) * sy;
    return { ...c, props: { ...c.props, x, y, width: Number(c.props.width) * sx, height: Number(c.props.height) * sy } };
  };
  const tracks = doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (c.id === group.id ? { ...c, props: { ...c.props, ...to } } : mapped(c))) }));
  return { ...doc, tracks };
}

export function placeLayer(doc: MotionDoc, clipId: string, patch: Record<string, unknown>): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip?.group) {
    return setProps(doc, clipId, patch);
  }

  const geometry = Object.fromEntries(GEOMETRY.flatMap((k) => (typeof patch[k] === 'number' ? [[k, patch[k]]] : []))) as Geometry;
  const rest = Object.fromEntries(Object.entries(patch).filter(([k]) => !(k in geometry)));
  const placed = regrouped(doc, clip, geometry);
  return Object.keys(rest).length ? setProps(placed, clipId, rest) : { ok: true, doc: placed };
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
