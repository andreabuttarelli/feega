import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { stateRowSchema, type ElementState, type StateRow, type StateRowInput } from '@feega/motion-core/motion/states/model';

const fail = (error: string): OpResult => ({ ok: false, error });

function withClip(doc: MotionDoc, clipId: string, write: (clip: MotionClip) => MotionClip): OpResult {
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? write(c as MotionClip) : c)) })) } };
}

const stored = (clip: MotionClip, rows: StateRow[]): MotionClip => ({ ...clip, states: rows.length ? rows : undefined });

export const statesOf = (doc: MotionDoc, clipId: string): StateRow[] => findClip(doc, clipId)?.clip.states ?? [];

export function putState(doc: MotionDoc, clipId: string, input: StateRowInput): OpResult {
  if (!findClip(doc, clipId)) {
    return fail(`no clip ${clipId}`);
  }

  const parsed = stateRowSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }

  const others = statesOf(doc, clipId).filter((r) => r.state !== parsed.data.state);
  return withClip(doc, clipId, (clip) => stored(clip, [...others, parsed.data]));
}

export function removeState(doc: MotionDoc, clipId: string, state: ElementState): OpResult {
  if (!findClip(doc, clipId)) {
    return fail(`no clip ${clipId}`);
  }

  const rows = statesOf(doc, clipId);
  if (!rows.some((r) => r.state === state)) {
    return fail(`no ${state} state on ${clipId}`);
  }
  return withClip(doc, clipId, (clip) => stored(clip, rows.filter((r) => r.state !== state)));
}
