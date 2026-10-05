import { findClip, type MotionClip, type MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { TEXT_COMPONENTS, onPathProblem } from '../text-animators/ops';
import { PathSourceKind, TEXT_PATH_PREFIX, textPathSchema, type TextPath } from './model';

export type TextPathPatch = Partial<TextPath>;

const fail = (error: string): OpResult => ({ ok: false, error });

export const SHAPE_SOURCE = 'Shape';

function sourceProblem(doc: MotionDoc, path: TextPath): string | null {
  if (path.source.kind !== PathSourceKind.Clip) {
    return null;
  }
  const found = findClip(doc, path.source.clip);
  if (!found) {
    return `no clip ${path.source.clip} to take the path from`;
  }
  return found.clip.component === SHAPE_SOURCE ? null : `${path.source.clip} is a ${found.clip.component}; a text path comes from a Shape clip`;
}

function replaced(doc: MotionDoc, clipId: string, next: MotionClip): MotionDoc {
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? next : c)) })) };
}

export function setTextPath(doc: MotionDoc, clipId: string, patch: TextPathPatch): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  const clip = found.clip;
  if (!TEXT_COMPONENTS.has(clip.component)) {
    return fail(`${clip.component} has no text; a text path goes on ${[...TEXT_COMPONENTS].join(', ')}`);
  }
  if (!clip.textPath && !patch.source) {
    return fail('a new text path needs a source: a preset or a Shape clip');
  }

  const given = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  const parsed = textPathSchema.safeParse({ ...clip.textPath, ...given });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const problem = sourceProblem(doc, parsed.data) ?? onPathProblem(clip.animators);
  return problem ? fail(problem) : { ok: true, doc: replaced(doc, clipId, { ...clip, textPath: parsed.data }) };
}

export function removeTextPath(doc: MotionDoc, clipId: string): OpResult {
  const found = findClip(doc, clipId);
  if (!found?.clip.textPath) {
    return fail(`${clipId} has no text path`);
  }
  const owned = (key: string) => key.startsWith(`${TEXT_PATH_PREFIX}.`);
  const keep = <T>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([key]) => !owned(key)));
  return { ok: true, doc: replaced(doc, clipId, { ...found.clip, textPath: null, keyframes: keep(found.clip.keyframes), expressions: keep(found.clip.expressions) }) };
}
