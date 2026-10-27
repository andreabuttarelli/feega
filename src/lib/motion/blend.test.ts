import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import { setParent } from './parent-ops';
import { setCamera } from '@feega/motion-core/motion/camera-ops';
import { cameraMath, stageSpec } from '@feega/motion-core/motion/camera';
import { sampleTrack } from '@feega/motion-core/motion/keyframes';
import { BLEND_MODES, BlendMode } from '@feega/motion-core/motion/blend';
import { setBlendMode } from './blend-ops';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function twoLayers(): MotionDoc {
  let doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 60 }, 'bg'));
  doc = ok(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60 }, 'top'));
  return doc;
}

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });
const layerOf = (html: string, id: string) => new RegExp(`<div id="c-${id}" class="clip layer"[^>]*>`).exec(html)?.[0] ?? '';

describe('blend modes', () => {
  it('has the After Effects blend set, normal by default, kept by a parse round trip', () => {
    expect(BLEND_MODES).toHaveLength(26);
    const doc = ok(setBlendMode(twoLayers(), 'top', BlendMode.Multiply));
    const parsed = parseMotionDoc(JSON.parse(JSON.stringify(doc)));

    expect(findClip(twoLayers(), 'top')!.clip.blend).toBe(BlendMode.Normal);
    expect(parsed.ok && findClip(parsed.doc, 'top')!.clip.blend).toBe(BlendMode.Multiply);
  });

  it('refuses an audio clip and an unknown clip', () => {
    let doc = ok(addClip(twoLayers(), { component: 'Audio', from: 0, durationInFrames: 30 }, 'music'));
    expect(setBlendMode(doc, 'music', BlendMode.Screen)).toMatchObject({ ok: false });
    expect(setBlendMode(doc, 'nope', BlendMode.Screen)).toMatchObject({ ok: false, error: expect.stringContaining('nope') });
  });

  it('a blended layer carries mix-blend-mode on its own layer, and the frame isolates the group', () => {
    const html = compose(ok(setBlendMode(twoLayers(), 'top', BlendMode.ColorDodge)));

    expect(layerOf(html, 'top')).toContain('mix-blend-mode:color-dodge');
    expect(layerOf(html, 'bg')).not.toContain('mix-blend-mode');
    expect(html).toContain('#root{position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate}');
  });

  it('a shader-only mode adds no invalid CSS to the markup', () => {
    const html = compose(ok(setBlendMode(twoLayers(), 'top', BlendMode.LinearDodge)));

    expect(layerOf(html, 'top')).not.toContain('mix-blend-mode');
  });

  it('normal adds nothing to the markup', () => {
    expect(compose(twoLayers())).not.toContain('mix-blend-mode');
  });

  it('a child does not inherit its parent blend mode: blending is per layer, as in After Effects', () => {
    let doc = ok(addClip(twoLayers(), { component: 'Text', from: 0, durationInFrames: 60 }, 'child'));
    doc = ok(setBlendMode(doc, 'top', BlendMode.Screen));
    doc = ok(setParent(doc, 'child', 'top'));
    const html = compose(doc);

    expect(layerOf(html, 'child')).not.toContain('mix-blend-mode');
    expect(layerOf(html, 'top')).toContain('mix-blend-mode:screen');
  });

  it('with the camera on, a blended world clip leaves the 3D world (blending would flatten it) and carries the world matrix itself under the frame perspective', () => {
    const doc = ok(setBlendMode(ok(setCamera(twoLayers(), { base: {} })), 'top', BlendMode.Multiply));
    const html = compose(doc);
    const world = /<div id="world" class="world">(.*)<!--\/world-->/s.exec(html)![1];

    expect(world).toContain('data-clip="bg"');
    expect(world).not.toContain('data-clip="top"');
    expect(layerOf(html, 'top')).toMatch(/transform:matrix3d\([^)]*\) translate3d/);
    expect(layerOf(html, 'top')).toContain('mix-blend-mode:multiply');
  });

  it('a projected layer lands where the same layer in the 3D world would: world · own, under the root perspective', () => {
    const doc = ok(setBlendMode(ok(setCamera(twoLayers(), { base: { z: 300, rotateY: 10 } })), 'top', BlendMode.Screen));
    const spec = stageSpec(doc);
    const frame = cameraMath(sampleTrack).frameAt(spec, 0);
    const top = frame.layers.find((l) => l.id === 'top')!;
    const bg = frame.layers.find((l) => l.id === 'bg')!;

    expect(top.transform).toBe(`matrix3d(${frame.world.join(',')}) ${bg.transform}`);
  });
});
