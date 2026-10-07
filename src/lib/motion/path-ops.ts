import { findClip, type MotionClip, type MotionDoc } from './doc';
import { pathProblem, type MotionPath, type PathTangent } from './path';
import type { OpResult } from './timeline';

const fail = (error: string): OpResult => ({ ok: false, error });

function withPath(doc: MotionDoc, clipId: string, edit: (clip: MotionClip) => MotionPath | null | string): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  const path = edit(found.clip);
  if (typeof path === 'string') {
    return fail(path);
  }
  const problem = pathProblem({ ...found.clip, path });
  if (problem) {
    return fail(problem);
  }
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, path } : c)) })) } };
}

export function setMotionPath(doc: MotionDoc, clipId: string, patch: { enabled?: boolean; autoOrient?: boolean }): OpResult {
  return withPath(doc, clipId, (clip) => {
    if (patch.enabled === false) {
      return null;
    }
    const current = clip.path ?? { autoOrient: false, tangents: [] };
    return { ...current, autoOrient: patch.autoOrient ?? current.autoOrient };
  });
}

export function setPathTangent(doc: MotionDoc, clipId: string, tangent: PathTangent): OpResult {
  return withPath(doc, clipId, (clip) => {
    if (!clip.path) {
      return 'turn the motion path on first (set_motion_path)';
    }
    if (!clip.keyframes.x?.some((k) => k.frame === tangent.frame)) {
      return `no position keyframe at frame ${tangent.frame}`;
    }
    return { ...clip.path, tangents: [...clip.path.tangents.filter((t) => t.frame !== tangent.frame), tangent].sort((a, b) => a.frame - b.frame) };
  });
}
