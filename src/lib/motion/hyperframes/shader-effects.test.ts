import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { composeHtml } from './compose';
import { Ease } from '../design';
import { Script, scriptUrl } from '../libs/catalog';
import { webglPerLane } from '../export/webgl-budget';
import { shaderCanvasId } from './shader-effects';

const ORIGIN = 'https://app.test';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const withEffect = (props: Record<string, unknown>) => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'ShaderEffect', from: 0, durationInFrames: 60, props }, 'fx'));

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: { pic: 'https://cdn.test/pic.png' }, origin: ORIGIN });

describe('a shader effect clip in the page', () => {
  it('loads the self-hosted library once and paints into its own canvas', () => {
    const html = compose(withEffect({ effect: 'plasma' }));

    expect(html.split(scriptUrl(ORIGIN, Script.Shaders)).length - 1).toBe(2);
    expect(html).toContain(`id="${shaderCanvasId('fx')}"`);
    expect(html).toContain("buildReady[\"motion-shader-effects\"]");
  });

  it('costs no WebGL context of the export budget', () => {
    expect(webglPerLane(compose(withEffect({ effect: 'liquid-metal' })))).toBe(0);
  });

  it('bakes keyed knobs frame by frame and resolves brand colours', () => {
    const doc = must(setKeyframes(withEffect({ effect: 'vignette', image: 'pic', color: 'brand.primary' }), 'fx', 'intensity', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 59, value: 1, ease: Ease.Linear }]));

    const html = compose(doc);

    expect(html).toContain('"effect":"vignette"');
    expect(html).not.toContain('"color":"brand.primary"');
    expect(html).toContain('"image":"https://cdn.test/pic.png"');
    expect(html).toContain('{"intensity":1}');
  });

  it('leaves pages without shader effects untouched', () => {
    expect(compose(newMotionDoc(MotionFormat.Landscape))).not.toContain(scriptUrl(ORIGIN, Script.Shaders));
  });
});
