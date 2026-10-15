import { compOf, findClip, type MotionClip, type MotionDoc, type MotionTrack } from './doc';
import { TRANSFORM, TRANSFORM_KEYS, type TransformKey } from './keyframes';
import { precompose } from './precomp';
import type { OpResult } from './timeline';

type NewId = () => string;

const GROUP_NAME = 'Group';
const CARRIED: readonly TransformKey[] = ['x', 'y'];

const fail = (error: string): OpResult => ({ ok: false, error });

export function groupClips(doc: MotionDoc, clipIds: readonly string[], newId: NewId): OpResult {
  const count = Object.values(doc.comps).filter((c) => c.name.startsWith(GROUP_NAME)).length + 1;
  return precompose(doc, clipIds, { comp: newId(), clip: newId() }, `${GROUP_NAME} ${count}`);
}

const bakesAsIs = (group: MotionClip) =>
  TRANSFORM_KEYS.every((key) => CARRIED.includes(key) || (group.transform[key] ?? TRANSFORM[key].fallback) === TRANSFORM[key].fallback) && !TRANSFORM_KEYS.some((key) => group.keyframes[key]?.length);

function carried(clip: MotionClip, group: MotionClip): MotionClip {
  const transform = { ...clip.transform };
  for (const key of CARRIED) {
    const offset = group.transform[key] ?? TRANSFORM[key].fallback;
    if (offset !== TRANSFORM[key].fallback) {
      transform[key] = (transform[key] ?? TRANSFORM[key].fallback) + offset;
    }
  }
  return { ...clip, from: clip.from + group.from - group.trimStart, transform };
}

function freshTrackId(taken: Set<string>, id: string, newId: NewId): string {
  let next = id;
  while (taken.has(next)) {
    next = newId();
  }
  taken.add(next);
  return next;
}

export function ungroupClip(doc: MotionDoc, clipId: string, newId: NewId): OpResult {
  const found = findClip(doc, clipId);
  const comp = found ? compOf(found.clip) : null;
  const inner = comp ? doc.comps[comp] : null;
  const at = found ? doc.tracks.findIndex((t) => t.id === found.track.id) : -1;
  if (!found || !comp || !inner || at < 0) {
    return fail(`${clipId} is not a group on a top-level track`);
  }
  if (!bakesAsIs(found.clip)) {
    return fail('reset the group scale, rotation and animation before ungrouping');
  }

  const taken = new Set(doc.tracks.map((t) => t.id));
  const released: MotionTrack[] = inner.tracks.map((t) => ({ ...t, id: freshTrackId(taken, t.id, newId), clips: (t.clips as MotionClip[]).map((c) => carried(c, found.clip)) }));
  const host = { ...doc.tracks[at], clips: doc.tracks[at].clips.filter((c) => c.id !== clipId) };
  const tracks = [...doc.tracks.slice(0, at), ...released, ...(host.clips.length ? [host] : []), ...doc.tracks.slice(at + 1)];
  const stillUsed = tracks.some((t) => t.clips.some((c) => compOf(c) === comp)) || Object.values(doc.comps).some((c) => c.tracks.some((t) => t.clips.some((k) => compOf(k) === comp)));
  const { [comp]: _gone, ...comps } = doc.comps;
  return { ok: true, doc: { ...doc, tracks, comps: stillUsed ? doc.comps : comps } };
}
