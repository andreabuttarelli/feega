import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, setKeyframes, type OpResult } from './timeline';
import { setMotionPath, setPathTangent } from './path-ops';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const lin = (frame: number, value: number) => ({ frame, value, ease: Ease.Linear });
const base = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 60 }, 's'));
const keyed = must(setKeyframes(must(setKeyframes(base, 's', 'x', [lin(0, 0), lin(30, 0.3)])), 's', 'y', [lin(0, 0), lin(30, 0.1)]));
const path = (doc: MotionDoc) => findClip(doc, 's')!.clip.path;

describe('motion path edits', () => {
  it('turns a position animation into a path, and back', () => {
    const on = must(setMotionPath(keyed, 's', { enabled: true, autoOrient: true }));
    expect(path(on)).toEqual({ autoOrient: true, tangents: [] });
    expect(path(must(setMotionPath(on, 's', { enabled: false })))).toBeNull();
  });

  it('refuses a path when x and y are not keyed together', () => {
    expect(setMotionPath(must(setKeyframes(base, 's', 'x', [lin(0, 0), lin(30, 0.3)])), 's', { enabled: true }).ok).toBe(false);
  });

  it('sets the tangents of one keyframe, replacing the old ones', () => {
    const on = must(setMotionPath(keyed, 's', { enabled: true }));
    const once = must(setPathTangent(on, 's', { frame: 0, in: [0, 0], out: [0.1, -0.1] }));
    const twice = must(setPathTangent(once, 's', { frame: 0, in: [0, 0], out: [0.2, 0] }));
    expect(path(twice)!.tangents).toEqual([{ frame: 0, in: [0, 0], out: [0.2, 0] }]);
  });

  it('a tangent needs a position keyframe at its time', () => {
    const on = must(setMotionPath(keyed, 's', { enabled: true }));
    expect(setPathTangent(on, 's', { frame: 12, in: [0, 0], out: [0.1, 0] }).ok).toBe(false);
  });
});
