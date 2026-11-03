import { compOf, findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { instanceBoxes } from '@feega/motion-core/motion/layout/resolve';
import { SEPARATOR, mergeView, viewOf } from '@feega/motion-core/motion/precomp';
import { pivotBox } from '@feega/motion-core/motion/parent';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { ComponentRole, roleOf, withSubtrees } from './main-component';
import { joinStackAt } from './layout/stack-drag';

export type Pt = [number, number];

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

const offsetOf = (doc: MotionDoc, clip: MotionClip): Pt => [Number(clip.transform.x ?? 0) * doc.width, Number(clip.transform.y ?? 0) * doc.height];

function centreOf(doc: MotionDoc, clip: MotionClip): Pt {
  const box = pivotBox(clip.props, { width: doc.width, height: doc.height });
  const [dx, dy] = offsetOf(doc, clip);
  return [box.left + box.width / 2 + dx, box.top + box.height / 2 + dy];
}

export function mainUnder(doc: MotionDoc, [x, y]: Pt, here: string | null, skip: ReadonlySet<string> = new Set()): string | null {
  const boxes = instanceBoxes(doc);
  const hits = clipsOf(doc).flatMap((clip) => {
    const box = boxes.get(clip.id);
    if (!box || skip.has(clip.id) || roleOf(doc, clip.id, here) !== ComponentRole.Main) {
      return [];
    }
    const [dx, dy] = offsetOf(doc, clip);
    const inside = x >= box.left + dx && x <= box.left + dx + box.width && y >= box.top + dy && y <= box.top + dy + box.height;
    return inside ? [{ id: clip.id, area: box.width * box.height }] : [];
  });
  return hits.sort((a, b) => a.area - b.area)[0]?.id ?? null;
}

function adopted(doc: MotionDoc, ids: readonly string[], host: MotionClip): MotionDoc {
  const taken = new Set(ids);
  const compId = compOf(host)!;
  const comp = doc.comps[compId];
  const shift = { x: Number(host.transform.x ?? 0), y: Number(host.transform.y ?? 0) };
  const start = host.from - host.trimStart;
  const moved = clipsOf(doc)
    .filter((c) => taken.has(c.id))
    .map((c) => {
      const root = !c.parent || !taken.has(c.parent);
      const props = root && typeof c.props.x === 'number' ? { ...c.props, x: Number(c.props.x) - shift.x, y: Number(c.props.y) - shift.y } : c.props;
      return { ...c, parent: root ? null : c.parent, props, from: c.from - start };
    });
  const [first, ...rest] = comp.tracks;
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !taken.has(c.id)) }));
  return { ...doc, tracks, comps: { ...doc.comps, [compId]: { ...comp, tracks: [{ ...first, clips: [...first.clips, ...moved] }, ...rest] } } };
}

export function landInside(doc: MotionDoc, clipId: string, here: string | null, at?: Pt): OpResult {
  const clip = findClip(doc, clipId)?.clip as MotionClip | undefined;
  if (!clip) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  const centre = at ?? centreOf(doc, clip);
  const hostId = mainUnder(doc, centre, here, new Set([clipId]));
  if (!hostId) {
    return joinStackAt(doc, clipId, centre);
  }
  const host = findClip(doc, hostId)!.clip as MotionClip;
  const [dx, dy] = offsetOf(doc, host);
  const inside = adopted(doc, withSubtrees(doc, [clipId]), host);
  const path = [compOf(host)!];
  const joined = joinStackAt(viewOf(inside, path), clipId, [centre[0] - dx, centre[1] - dy]);
  return joined.ok ? { ok: true, doc: mergeView(inside, path, joined.doc) } : joined;
}

export function dropIntoMain(doc: MotionDoc, clipId: string, here: string | null): OpResult | null {
  const clip = findClip(doc, clipId)?.clip as MotionClip | undefined;
  return clip && mainUnder(doc, centreOf(doc, clip), here, new Set([clipId])) ? landInside(doc, clipId, here) : null;
}

const FIRST_LOOP = 0;

export function landedScene(doc: MotionDoc, clipId: string): string | null {
  if (findClip(doc, clipId)) {
    return clipId;
  }
  const host = clipsOf(doc).find((c) => {
    const comp = compOf(c);
    return comp && doc.comps[comp]?.tracks.some((t) => t.clips.some((inner) => inner.id === clipId));
  });
  return host ? `${host.id}${SEPARATOR}${FIRST_LOOP}${SEPARATOR}${clipId}` : null;
}
