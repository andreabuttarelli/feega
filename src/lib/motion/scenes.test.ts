// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { flattenComps } from './precomp';
import { resolveScenes, sceneNodeIds, scenesLeftToRight, sequenceScenes } from './scenes';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const scene = (text: string, frames: number): MotionDoc =>
  must(addClip({ ...newMotionDoc(MotionFormat.Landscape), durationInFrames: frames }, { component: 'Text', from: 0, durationInFrames: frames, props: { text } }, 'title'));

const texts = (doc: MotionDoc) =>
  flattenComps(doc)
    .tracks.flatMap((t) => t.clips as MotionClip[])
    .filter((c) => c.component === 'Text')
    .map((c) => [c.props.text, c.from]);

describe('scenes sequenced in a parent frame', () => {
  it('places scenes back to back and stores only references', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
      { nodeId: A, durationInFrames: 60 },
      { nodeId: B, durationInFrames: 30 }
    ]);

    expect(parent.durationInFrames).toBe(90);
    expect(sceneNodeIds(parent)).toEqual([A, B]);
    expect(Object.keys(parent.comps)).toEqual([]);
    expect(JSON.stringify(parent)).not.toContain('hello');
    expect(parseMotionDoc(parent).ok).toBe(true);
  });

  it('editing a scene changes every placement of it', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
      { nodeId: A, durationInFrames: 60 },
      { nodeId: A, durationInFrames: 60 }
    ]);

    expect(texts(resolveScenes(parent, { [A]: scene('hello', 60) }))).toEqual([
      ['hello', 0],
      ['hello', 60]
    ]);
    expect(texts(resolveScenes(parent, { [A]: scene('edited', 60) }))).toEqual([
      ['edited', 0],
      ['edited', 60]
    ]);
  });

  it('a scene with no loaded doc is left out, not invented', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [{ nodeId: A, durationInFrames: 60 }]);

    expect(texts(resolveScenes(parent, {}))).toEqual([]);
  });

  it('orders frames left to right, top to bottom on ties', () => {
    const frames = [
      { id: 'c', x: 900, y: 0 },
      { id: 'a', x: 0, y: 50 },
      { id: 'b', x: 0, y: 400 }
    ];

    expect(scenesLeftToRight(frames)).toEqual(['a', 'b', 'c']);
  });
});
