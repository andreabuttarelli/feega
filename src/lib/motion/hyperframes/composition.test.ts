import { describe, expect, it } from 'vitest';
import { LAYOUTS } from '$lib/canvas/composition/index';
import { instancesOf, poseAt } from '$lib/canvas/composition/pose';
import type { LayoutId } from '$lib/canvas/composition/types';
import { FEEGA_TOKENS } from '../brand';
import { FPS } from '../design';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { composeHtml } from './compose';
import { CAMERA_FIELDS, INSTANCE_FIELDS, bakeComposition, type CompositionProps } from './composition';

const TOLERANCE = 1e-3;
const SAMPLED_FRAMES = [0, 7, 45, 90, 133, 179];
const PORTRAIT = { width: 1080, height: 1920 };
const ASSETS = { a: 'https://cdn.test/a.png', b: 'https://cdn.test/b.png', v: 'https://cdn.test/v.mp4' };

function propsFor(layout: LayoutId): CompositionProps {
  return {
    layout,
    media: [
      { assetId: 'a', kind: 'image' },
      { assetId: 'b', kind: 'image' },
      { assetId: 'v', kind: 'video' }
    ],
    layoutParams: {},
    camera: 'slow-orbit',
    cameraParams: {},
    background: '#000000',
    loop: 6
  };
}

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

describe('bakeComposition', () => {
  for (const layout of Object.keys(LAYOUTS) as LayoutId[]) {
    it(`${layout} bakes the same pose the canvas scene renders, at sampled frames`, () => {
      const bake = bakeComposition('c1', propsFor(layout), PORTRAIT, (id) => ASSETS[id as keyof typeof ASSETS] ?? null);
      const input = { layout, layoutParams: {}, camera: 'slow-orbit' as const, cameraParams: {}, duration: 6, mediaCount: 3, aspect: 1080 / 1920 };
      const stride = CAMERA_FIELDS + bake.instances.length * INSTANCE_FIELDS;

      expect(bake.instances).toEqual(instancesOf(input));
      for (const frame of SAMPLED_FRAMES) {
        const pose = poseAt(input, frame / FPS);
        const row = bake.frames.slice(frame * stride, (frame + 1) * stride);
        const expected = [
          pose.camera.position.x, pose.camera.position.y, pose.camera.position.z,
          pose.camera.target.x, pose.camera.target.y, pose.camera.target.z, pose.camera.fov,
          ...pose.transforms.flatMap((t) => [t.position.x, t.position.y, t.position.z, t.rotation.x, t.rotation.y, t.rotation.z, t.scale.x, t.scale.y, t.scale.z, t.opacity ?? 1])
        ];

        expect(row).toHaveLength(expected.length);
        row.forEach((value, i) => expect(Math.abs(value - expected[i])).toBeLessThan(TOLERANCE));
      }
    });
  }

  it('bakes exactly one loop, so the clip repeats it for as long as it lasts', () => {
    const bake = bakeComposition('c1', { ...propsFor('helix'), loop: 2 }, PORTRAIT, (id) => ASSETS[id as keyof typeof ASSETS] ?? null);

    expect(bake.loopFrames).toBe(2 * FPS);
    expect(bake.frames).toHaveLength(2 * FPS * (CAMERA_FIELDS + bake.instances.length * INSTANCE_FIELDS));
  });

  it('drops media whose asset is gone instead of showing a hole', () => {
    const bake = bakeComposition('c1', propsFor('helix'), PORTRAIT, (id) => (id === 'a' ? ASSETS.a : null));

    expect(bake.media).toEqual([{ url: ASSETS.a, kind: 'image' }]);
  });
});

describe('Composition clip in a motion doc', () => {
  const doc = must(addClip(newMotionDoc(MotionFormat.Vertical), { component: 'Composition', from: 0, durationInFrames: 180, props: propsFor('coverflow') }, 'comp'));

  it('renders a full-frame WebGL stage driven by the baked pose', () => {
    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: ASSETS });

    expect(html).toContain('<canvas id="comp-comp" width="1080" height="1920"');
    expect(html).toContain('motion-composition');
    expect(html).toContain(ASSETS.v);
  });

  it('gives each video a timed element the renderer can extract frames from', () => {
    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: ASSETS });

    expect(html).toContain(`<video id="cv-comp-2" src="${ASSETS.v}"`);
    expect(html).toContain('data-start="0" data-duration="6"');
    expect(html).not.toContain('<video id="cv-comp-0"');
  });

  it('asks for media when none of it resolves', () => {
    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

    expect(html).toContain('Add images or videos');
    expect(html).not.toContain('<canvas id="comp-comp"');
  });
});
