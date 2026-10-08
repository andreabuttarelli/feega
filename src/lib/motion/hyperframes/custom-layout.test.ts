import { describe, expect, it } from 'vitest';
import { FPS } from '../design';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '../doc';
import { addClip } from '../timeline';
import { bakeComposition, CAMERA_FIELDS, INSTANCE_FIELDS, type CompositionProps } from './composition';

const RING = {
  kind: 'spec' as const,
  camera: 'fixed' as const,
  motion: 'cycle' as const,
  slots: 6,
  place: { kind: 'ring' as const, radius: 3 },
  animate: [{ prop: 'y' as const, amp: 0.4, freq: 1, phase: { index: 1 } }]
};

const props = (): CompositionProps =>
  ({
    layout: 'custom',
    layoutSpec: RING,
    layoutRef: 'lay-1',
    media: [
      { assetId: 'a', kind: 'image' },
      { assetId: 'b', kind: 'image' }
    ],
    layoutParams: {},
    camera: 'slow-orbit',
    cameraParams: {},
    background: '#000000',
    loop: 2
  }) as CompositionProps;

describe('a composition on a custom spec layout', () => {
  it('validates in a motion doc', () => {
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Composition', from: 0, durationInFrames: 60, props: props() }, 'comp');

    expect(added.ok && parseMotionDoc(JSON.parse(JSON.stringify(added.doc))).ok).toBe(true);
  });

  it('bakes the slots of its spec, frame by frame', () => {
    const bake = bakeComposition('comp', props(), { width: 1920, height: 1080, fps: FPS }, (id) => `https://cdn.test/${id}.png`);

    expect(bake.instances).toHaveLength(6);
    const perFrame = CAMERA_FIELDS + 6 * INSTANCE_FIELDS;
    expect(bake.frames).toHaveLength(bake.loopFrames * perFrame);
    expect(bake.frames.every(Number.isFinite)).toBe(true);
  });
});
