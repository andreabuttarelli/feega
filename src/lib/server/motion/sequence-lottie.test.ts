import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { JunctionKind } from '$lib/motion/junction-model';
import { lottieOf } from '$lib/motion/export-lottie';
import { sequenceScenes, sceneTransition } from '$lib/motion/scenes';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { withScenes } from '$lib/canvas/scene-sources';
import { Span, vectorOf } from './vector-list';

const IDS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const SCENE_FRAMES = 12;
const FADE_FRAMES = 4;

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const scene = (fill: string): MotionDoc =>
  must(addClip({ ...newMotionDoc(MotionFormat.Landscape), durationInFrames: SCENE_FRAMES }, { component: 'Shape', from: 0, durationInFrames: SCENE_FRAMES, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fill } }, 'fill'));

const scenes: Record<string, MotionDoc> = { [IDS[0]]: scene('#ff0000'), [IDS[1]]: scene('#00ff00'), [IDS[2]]: scene('#0000ff') };

const sequence = async () => {
  const host = sequenceScenes({ ...newMotionDoc(MotionFormat.Landscape) }, IDS.map((nodeId) => ({ nodeId, durationInFrames: SCENE_FRAMES })));
  const second = host.tracks.flatMap((t) => t.clips).find((c) => c.from === SCENE_FRAMES)!;
  const joined = must(sceneTransition(host, second.id, { kind: JunctionKind.Crossfade, durationInFrames: FADE_FRAMES }));
  return (await withScenes({ doc: joined, assets: {} }, async (id) => ({ doc: scenes[id], assets: {} }))).doc;
};

describe('Lottie export of a three-scene sequence', () => {
  it('animates every scene across the whole sequence, with nothing skipped', async () => {
    const doc = await sequence();
    const { lists } = await vectorOf({ doc, tokens: FEEGA_TOKENS, assets: {} }, Span.Whole);

    const { json, report } = lottieOf(lists, { width: doc.width, height: doc.height, fps: doc.fps });

    expect(report).toEqual([]);
    expect(json.op).toBe(SCENE_FRAMES * IDS.length);
    const named = (json.layers as { nm: string }[]).map((l) => l.nm).filter((nm) => nm.startsWith('scene-'));
    expect(new Set(named.map((nm) => nm.split('__')[0]))).toEqual(new Set(['scene-1', 'scene-2', 'scene-3']));
  });
});
