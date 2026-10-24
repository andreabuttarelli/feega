// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { flattenComps } from '$lib/motion/precomp';
import { sequenceScenes } from '$lib/motion/scenes';
import { sceneStamp, withScenes, type SceneSource } from './scene-sources';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function scene(text: string, assetId: string): SceneSource {
  const made = addClip({ ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 30 }, { component: 'Text', from: 0, durationInFrames: 30, props: { text } }, 'title');
  if (!made.ok) {
    throw new Error(made.error);
  }
  return { doc: made.doc, assets: { [assetId]: `https://x/${assetId}` } };
}

const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
  { nodeId: A, durationInFrames: 30 },
  { nodeId: B, durationInFrames: 30 }
]);

const texts = (doc: MotionDoc) =>
  flattenComps(doc)
    .tracks.flatMap((t) => t.clips as MotionClip[])
    .filter((c) => c.component === 'Text')
    .sort((a, b) => a.from - b.from)
    .map((c) => c.props.text);

describe('scene sources', () => {
  it('loads each scene once and merges its assets', async () => {
    const asked: string[] = [];
    const load = async (id: string) => (asked.push(id), id === A ? scene('one', 'a1') : scene('two', 'b1'));

    const drawn = await withScenes({ doc: parent, assets: { own: 'https://x/own' } }, load);

    expect(asked).toEqual([A, B]);
    expect(texts(drawn.doc)).toEqual(['one', 'two']);
    expect(Object.keys(drawn.assets).sort()).toEqual(['a1', 'b1', 'own']);
  });

  it('a doc with no scenes loads nothing and comes back as it was', async () => {
    const plain = { doc: newMotionDoc(MotionFormat.Landscape), assets: {} };
    const drawn = await withScenes(plain, async () => {
      throw new Error('no load expected');
    });

    expect(drawn).toBe(plain);
  });

  it('stamps a parent with its scenes revisions so a scene edit redraws it', () => {
    const revisions: Record<string, number> = { [A]: 3, [B]: 7 };

    expect(sceneStamp(parent, (id) => revisions[id] ?? 0)).toBe(`${A}@3,${B}@7`);
    expect(sceneStamp(newMotionDoc(MotionFormat.Landscape), () => 1)).toBe('');
  });
});
