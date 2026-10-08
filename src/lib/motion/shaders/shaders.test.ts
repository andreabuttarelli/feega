import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { FEEGA_TOKENS } from '../brand';
import { Ease } from '../design';
import { composeHtml } from '../hyperframes/compose';
import { addShader, removeShader, setShader } from './ops';
import { shaderBakes } from './compose';
import type { ShaderSnapshot } from './model';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const VHS: ShaderSnapshot = {
  name: 'vhs',
  version: 2,
  frag: 'vec4 effect(vec2 uv) { vec4 c = texture2D(u_src, uv); return vec4(c.rgb * u_amount + u_tint * 0.1, 1.0); }',
  params: [
    { key: 'amount', label: 'Amount', kind: 'number', min: 0, max: 2, step: 0.1, default: 1 },
    { key: 'tint', label: 'Tint', kind: 'color', default: '#3050ff' }
  ]
};

const withImage = () => {
  const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 0, durationInFrames: 60 }, 'pic'));
  return { ...doc, assets: [{ id: 'a1', name: 'a', kind: 'image' as const }] };
};

const clipOf = (doc: MotionDoc) => findClip(doc, 'pic')!.clip;

describe('custom shader effects on a motion clip', () => {
  it('adds a custom effect, snapshots the shader in the doc, and a parse round trip keeps both', () => {
    const doc = ok(addShader(withImage(), 'pic', 'fx1', { ref: 'eff-1', snapshot: VHS }, { amount: 1.5 }));
    const parsed = parseMotionDoc(JSON.parse(JSON.stringify(doc)));

    expect(parsed.ok).toBe(true);
    const back = parsed.ok ? parsed.doc : doc;
    expect(clipOf(back).shaders).toEqual([{ id: 'fx1', ref: 'eff-1', enabled: true, params: { amount: 1.5, tint: '#3050ff' } }]);
    expect(back.shaders['eff-1'].frag).toBe(VHS.frag);
  });

  it('refuses a text clip: v1 rasterises image and video only', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 30 }, 'title'));

    const out = addShader(doc, 'title', 'fx1', { ref: 'eff-1', snapshot: VHS });

    expect(out.ok).toBe(false);
  });

  it('refuses a value out of range and a second custom effect on the same clip', () => {
    expect(addShader(withImage(), 'pic', 'fx1', { ref: 'eff-1', snapshot: VHS }, { amount: 9 }).ok).toBe(false);

    const one = ok(addShader(withImage(), 'pic', 'fx1', { ref: 'eff-1', snapshot: VHS }));
    expect(addShader(one, 'pic', 'fx2', { ref: 'eff-1', snapshot: VHS }).ok).toBe(false);
  });

  it('a doc whose clip names a shader it does not carry does not validate', () => {
    const doc = ok(addShader(withImage(), 'pic', 'fx1', { ref: 'eff-1', snapshot: VHS }));

    expect(parseMotionDoc(JSON.parse(JSON.stringify({ ...doc, shaders: {} }))).ok).toBe(false);
  });

  it('animates params as fx.<id>.<key>, and remove drops their keyframes', () => {
    let doc = ok(addShader(withImage(), 'pic', 'fx1', { ref: 'eff-1', snapshot: VHS }));
    doc = ok(setKeyframes(doc, 'pic', 'fx.fx1.amount', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 59, value: 2, ease: Ease.Linear }]));

    expect(clipOf(doc).keyframes['fx.fx1.amount']).toHaveLength(2);
    expect(ok(setShader(doc, 'pic', 'fx1', { enabled: false })).tracks[0].clips[0]).toMatchObject({ shaders: [{ enabled: false }] });
    expect(clipOf(ok(removeShader(doc, 'pic', 'fx1'))).keyframes['fx.fx1.amount']).toBeUndefined();
  });

  it('bakes per-frame uniforms for an animated param and constants otherwise', () => {
    let doc = ok(addShader(withImage(), 'pic', 'fx1', { ref: 'eff-1', snapshot: VHS }));
    doc = ok(setKeyframes(doc, 'pic', 'fx.fx1.amount', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 59, value: 2, ease: Ease.Linear }]));
    const parsed = parseMotionDoc(JSON.parse(JSON.stringify(doc)));
    doc = parsed.ok ? parsed.doc : doc;

    const [bake] = shaderBakes(clipOf(doc), doc, { start: 0, fps: 30, color: (c) => c });

    expect(bake.clipId).toBe('pic');
    expect(bake.values.tint).toBe('#3050ff');
    expect(Array.isArray(bake.values.amount) && bake.values.amount).toHaveLength(60);
  });

  it('composes the shader runtime only when a clip uses one', () => {
    const plain = composeHtml({ doc: withImage(), tokens: FEEGA_TOKENS, assets: { a1: 'https://example.com/a.png' } });
    const shaded = composeHtml({ doc: ok(addShader(withImage(), 'pic', 'fx1', { ref: 'eff-1', snapshot: VHS })), tokens: FEEGA_TOKENS, assets: { a1: 'https://example.com/a.png' } });

    expect(plain).not.toContain('__shaderClips');
    expect(shaded).toContain('__shaderClips');
    expect(shaded).toContain('u_amount');
  });
});
