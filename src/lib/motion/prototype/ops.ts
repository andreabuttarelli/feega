import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { MAX_INTERACTIONS, interactionSchema, type Interaction, type InteractionInput } from '@feega/motion-core/motion/prototype/model';

const fail = (error: string): OpResult => ({ ok: false, error });

function withClip(doc: MotionDoc, clipId: string, write: (clip: MotionClip) => MotionClip): OpResult {
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? write(c as MotionClip) : c)) })) } };
}

const stored = (clip: MotionClip, list: Interaction[]): MotionClip => ({ ...clip, interactions: list.length ? list : undefined });

export const interactionsOf = (doc: MotionDoc, clipId: string): Interaction[] => findClip(doc, clipId)?.clip.interactions ?? [];

export function putInteraction(doc: MotionDoc, clipId: string, input: InteractionInput): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  const parsed = interactionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const others = interactionsOf(doc, clipId).filter((i) => i.id !== parsed.data.id);
  if (others.length >= MAX_INTERACTIONS) {
    return fail(`a clip holds at most ${MAX_INTERACTIONS} interactions`);
  }
  const replaced = interactionsOf(doc, clipId).map((i) => (i.id === parsed.data.id ? parsed.data : i));
  const next = replaced.some((i) => i.id === parsed.data.id) ? replaced : [...others, parsed.data];
  return withClip(doc, clipId, (clip) => stored(clip, next));
}

export function removeInteraction(doc: MotionDoc, clipId: string, id: string): OpResult {
  if (!findClip(doc, clipId)) {
    return fail(`no clip ${clipId}`);
  }
  const list = interactionsOf(doc, clipId);
  if (!list.some((i) => i.id === id)) {
    return fail(`no interaction ${id} on ${clipId}`);
  }
  return withClip(doc, clipId, (clip) => stored(clip, list.filter((i) => i.id !== id)));
}
