import type { MotionClip, MotionDoc } from './doc';
import { Matte } from './mask';
import { layerOrder } from './siblings';
import type { OpResult } from './timeline';

type Membership = { matte: Matte; matteFrom: string | null };

const FREE: Membership = { matte: Matte.None, matteFrom: null };
const memberOf = (maskId: string): Membership => ({ matte: Matte.Alpha, matteFrom: maskId });

const fail = (error: string): OpResult => ({ ok: false, error });

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

const levelOf = (doc: MotionDoc, id: string) => layerOrder(doc).indexOf(id);

const isMember = (clip: MotionClip) => !!clip.matteFrom && clip.matte !== Matte.None;

export function maskMembers(doc: MotionDoc): Map<string, string[]> {
  const members = new Map<string, string[]>();
  for (const clip of clipsOf(doc).filter(isMember)) {
    members.set(clip.matteFrom!, [...(members.get(clip.matteFrom!) ?? []), clip.id]);
  }
  return members;
}

export function maskOf(doc: MotionDoc, clipId: string): string | null {
  const clip = clipsOf(doc).find((c) => c.id === clipId);
  return clip && isMember(clip) ? clip.matteFrom! : null;
}

function withMembership(doc: MotionDoc, ids: ReadonlySet<string>, membership: Membership): OpResult {
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (ids.has(c.id) ? { ...c, ...membership } : c)) })) } };
}

function refusal(doc: MotionDoc, clipId: string, maskId: string): string | null {
  const at = levelOf(doc, clipId);
  if (at < 0) {
    return `no layer ${clipId} at the top level of this frame`;
  }
  if (at >= levelOf(doc, maskId)) {
    return `${clipId} is not above the mask ${maskId}: a mask cuts the layers above it`;
  }
  return maskMembers(doc).has(clipId) ? `${clipId} is a mask itself: remove that mask first` : null;
}

export function useAsMask(doc: MotionDoc, ids: readonly string[]): OpResult {
  const unique = [...new Set(ids)];
  const missing = unique.find((id) => levelOf(doc, id) < 0);
  if (missing) {
    return fail(`no layer ${missing} at the top level of this frame`);
  }
  if (unique.length < 2) {
    return fail('select the mask and at least one layer above it');
  }

  const maskId = unique.reduce((low, id) => (levelOf(doc, id) > levelOf(doc, low) ? id : low));
  const targets = unique.filter((id) => id !== maskId);
  const refused = targets.map((id) => refusal(doc, id, maskId)).find(Boolean);
  if (refused) {
    return fail(refused);
  }

  const freed = withMembership(doc, new Set([maskId]), FREE);
  return freed.ok ? withMembership(freed.doc, new Set(targets), memberOf(maskId)) : freed;
}

export function releaseMask(doc: MotionDoc, maskId: string): OpResult {
  const members = maskMembers(doc).get(maskId);
  if (!members) {
    return fail(`${maskId} is not a mask`);
  }
  return withMembership(doc, new Set(members), FREE);
}

export function releaseMasks(doc: MotionDoc, ids: readonly string[]): OpResult {
  const members = maskMembers(doc);
  const masks = new Set(ids.map((id) => (members.has(id) ? id : maskOf(doc, id))).filter((id): id is string => id !== null));
  if (!masks.size) {
    return fail('nothing selected is a mask or masked');
  }
  return withMembership(doc, new Set([...masks].flatMap((id) => members.get(id)!)), FREE);
}

export function joinMask(doc: MotionDoc, clipId: string, maskId: string): OpResult {
  const refused = refusal(doc, clipId, maskId);
  return refused ? fail(refused) : withMembership(doc, new Set([clipId]), memberOf(maskId));
}

export function leaveMask(doc: MotionDoc, clipId: string): OpResult {
  return maskOf(doc, clipId) ? withMembership(doc, new Set([clipId]), FREE) : { ok: true, doc };
}
