// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { flattenComps } from '@feega/motion-core/motion/precomp';
import { appendScene, insertSceneAt, insertableScenes, reorderScenes, sceneEdit, resolveScenes, sceneNodeIds, scenesLeftToRight, scenesOf, sceneTransition, sequenceScenes, trimScene } from './scenes';
import { JunctionKind } from '@feega/motion-core/motion/junction-model';

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
    .sort((a, b) => a.from - b.from)
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

  it('a later scene draws above the one before it, so a crossfade into it shows', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
      { nodeId: A, durationInFrames: 60 },
      { nodeId: B, durationInFrames: 60 }
    ]);

    const ids = flattenComps(resolveScenes(parent, { [A]: scene('a', 60), [B]: scene('b', 60) })).tracks.map((t) => t.id);

    expect(ids.indexOf('scene-2__group')).toBeLessThan(ids.indexOf('scene-1__group'));
  });

  it('a scene with no loaded doc is left out, not invented', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [{ nodeId: A, durationInFrames: 60 }]);

    expect(texts(resolveScenes(parent, {}))).toEqual([]);
  });

  it('reordering repacks scenes back to back and keeps each duration', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
      { nodeId: A, durationInFrames: 60 },
      { nodeId: B, durationInFrames: 30 }
    ]);

    const swapped = must(reorderScenes(parent, ['scene-2', 'scene-1']));

    expect(scenesOf(swapped).map((s) => [s.nodeId, s.from, s.durationInFrames])).toEqual([
      [B, 0, 30],
      [A, 30, 60]
    ]);
  });

  it('trimming a scene shifts the ones after it and the total', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
      { nodeId: A, durationInFrames: 60 },
      { nodeId: B, durationInFrames: 30 }
    ]);

    const trimmed = must(trimScene(parent, 'scene-1', 20));

    expect(scenesOf(trimmed).map((s) => s.from)).toEqual([0, 20]);
    expect(trimmed.durationInFrames).toBe(50);
  });

  it('a transition joins a scene to the one before it, never the first', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
      { nodeId: A, durationInFrames: 60 },
      { nodeId: B, durationInFrames: 30 }
    ]);

    const joined = must(sceneTransition(parent, 'scene-2', { kind: JunctionKind.Crossfade, durationInFrames: 12 }));
    expect(scenesOf(joined)[1].junction).toEqual({ kind: JunctionKind.Crossfade, durationInFrames: 12 });

    expect(sceneTransition(parent, 'scene-1', { kind: JunctionKind.Crossfade, durationInFrames: 12 }).ok).toBe(false);
    expect(scenesOf(must(reorderScenes(joined, ['scene-2', 'scene-1'])))[0].junction).toBeNull();
  });

  it('appending a scene places it after the last one', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [{ nodeId: A, durationInFrames: 60 }]);

    const grown = appendScene(parent, { nodeId: B, durationInFrames: 30 });

    expect(scenesOf(grown).map((s) => [s.nodeId, s.from])).toEqual([
      [A, 0],
      [B, 60]
    ]);
    expect(new Set(scenesOf(grown).map((s) => s.clipId)).size).toBe(2);
  });

  it('inserting at a time lands on the nearest scene boundary', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
      { nodeId: A, durationInFrames: 60 },
      { nodeId: A, durationInFrames: 60 }
    ]);
    const order = (frame: number) => scenesOf(insertSceneAt(parent, { nodeId: B, durationInFrames: 30 }, frame)).map((s) => s.nodeId);

    expect(order(0)).toEqual([B, A, A]);
    expect(order(25)).toEqual([B, A, A]);
    expect(order(35)).toEqual([A, B, A]);
    expect(order(70)).toEqual([A, B, A]);
    expect(order(100)).toEqual([A, A, B]);
    expect(order(500)).toEqual([A, A, B]);
  });

  it('the edit entry point inserts at a time in seconds', () => {
    const seconds = (s: number) => Math.round(s * 30);
    const start = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
      { nodeId: A, durationInFrames: 60 },
      { nodeId: A, durationInFrames: 60 }
    ]);

    const inserted = must(sceneEdit(start, { op: 'insert', node_id: B, duration: 1, at: 2 }, seconds));

    expect(scenesOf(inserted).map((s) => s.nodeId)).toEqual([A, B, A]);
  });

  it('one edit entry point serves the agent tools', () => {
    const seconds = (s: number) => Math.round(s * 30);
    const start = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [{ nodeId: A, durationInFrames: 60 }]);

    const inserted = must(sceneEdit(start, { op: 'insert', node_id: B, duration: 1 }, seconds));
    const trimmed = must(sceneEdit(inserted, { op: 'trim', clip_id: 'scene-1', duration: 0.5 }, seconds));
    const removed = must(sceneEdit(trimmed, { op: 'remove', clip_id: 'scene-1' }, seconds));

    expect(scenesOf(trimmed).map((s) => [s.nodeId, s.from, s.durationInFrames])).toEqual([
      [A, 0, 15],
      [B, 15, 30]
    ]);
    expect(scenesOf(removed).map((s) => [s.nodeId, s.from])).toEqual([[B, 0]]);
  });

  it('offers as new scenes the frames that are not themselves sequences', () => {
    const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [{ nodeId: A, durationInFrames: 60 }]);
    const frames = [
      { id: A, doc: scene('hello', 60) },
      { id: B, doc: scene('world', 30) },
      { id: 'parent', doc: parent }
    ];

    expect(insertableScenes(frames)).toEqual([
      { nodeId: A, label: 'hello', durationInFrames: 60 },
      { nodeId: B, label: 'world', durationInFrames: 30 }
    ]);
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
