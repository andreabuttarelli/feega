import { CAMERA, CAMERA_LANE, newCamera, type CameraKey } from '../camera';
import { withParams } from '../custom/params';
import { findClip, type MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { expressionErrors } from './bake';
import { compileExpression } from './language';
import { expressionProblem, type Expressions } from './schema';
import { liveInputProblem } from '../interactive/live-props';

const fail = (error: string): OpResult => ({ ok: false, error });

function withSource(expressions: Partial<Expressions>, key: string, source: string | null): Expressions {
  const { [key]: _dropped, ...rest } = expressions as Expressions;
  return source === null ? rest : { ...rest, [key]: source };
}

function checked(doc: MotionDoc, id: string, key: string): OpResult {
  const fault = expressionErrors(doc).find((f) => f.clipId === id && f.key === key);
  return fault ? fail(`${key}: ${fault.error}`) : { ok: true, doc };
}

export function setExpression(doc: MotionDoc, clipId: string, key: string, source: string | null): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  const clip = withParams(doc, found.clip);
  const problem = source === null ? null : (expressionProblem(clip, key, source) ?? liveInputProblem(clip, key, source));
  if (problem) {
    return fail(problem);
  }

  const next: MotionDoc = {
    ...doc,
    tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, expressions: withSource(c.expressions, key, source) } : c)) }))
  };
  return source === null ? { ok: true, doc: next } : checked(next, clipId, key);
}

export function setCameraExpression(doc: MotionDoc, key: CameraKey, source: string | null): OpResult {
  if (!(key in CAMERA)) {
    return fail(`the camera has no ${key}`);
  }
  const compiled = source === null ? null : compileExpression(source);
  if (compiled && !compiled.ok) {
    return fail(`${key}: ${compiled.error}`);
  }

  const camera = doc.camera ?? newCamera();
  const next: MotionDoc = { ...doc, camera: { ...camera, expressions: withSource(camera.expressions, key, source) } };
  return source === null ? { ok: true, doc: next } : checked(next, CAMERA_LANE, key);
}
