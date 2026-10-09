import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type DocVerdict, type MotionDoc } from '../doc';
import { addClip } from '../timeline';
import { EnvPreset, LightKind } from '../look';
import { setLight, setLook } from '../look-ops';
import { Target, composeHtml } from './compose';
import { EnvLoad } from './three';
import { APP_ORIGIN, Module, moduleUrl } from '../libs/catalog';
const OPENTYPE_URL = moduleUrl(APP_ORIGIN, Module.Opentype);

const must = (r: DocVerdict): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const compose = (doc: MotionDoc, assets: Record<string, string> = {}) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets });
const csp = (html: string) => html.match(/Content-Security-Policy" content="([^"]+)"/)![1];

describe('3D look in the composed page', () => {
  it('carries the look and lets the page fetch the environment file', () => {
    const shape = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape3D', from: 0, props: { material: 'chrome' } }, 's'));
    const lit = must(setLight(must(setLook(shape, { environment: { preset: EnvPreset.Overpass } })), 'key', { kind: LightKind.Spot }));
    const html = compose(lit);
    expect(html).toContain('"kind":"spot"');
    expect(html).toContain('"metalness":1');
    expect(csp(html)).toMatch(/connect-src[^;]*https:\/\/feega\.app/);
    expect(html).toContain(`${APP_ORIGIN}/motion-env/r181/pedestrian_overpass_256.hdr`);
    expect(html).not.toContain('jsdelivr');
  });

  it('a live page draws its first frame with fallback light and swaps the environment in; an export waits for it', () => {
    const shape = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape3D', from: 0 }, 's'));
    const doc = must(setLook(shape, { environment: { preset: EnvPreset.Night } }));

    expect(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, target: Target.Screen })).toContain(`"envLoad":"${EnvLoad.Swap}"`);
    expect(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, target: Target.Video })).toContain(`"envLoad":"${EnvLoad.Wait}"`);
  });

  it('without a look the page keeps the old lighting and fetches nothing new', () => {
    const html = compose(must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape3D', from: 0 }, 's')));
    expect(html).toContain('const LOOK = null');
    expect(csp(html)).not.toContain('cdn.jsdelivr.net/gh');
    expect(csp(html)).not.toContain(OPENTYPE_URL);
  });

  it('3D text loads the font outline and the parser that reads it', () => {
    const html = compose(must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text3D', from: 0, props: { text: 'Feega' } }, 't')));
    expect(html).toContain('<canvas id="three-t"');
    expect(html).toContain('dm-sans@latest/latin-700-normal.woff');
    expect(csp(html)).toContain(OPENTYPE_URL);
  });

  it('3D logo falls back to the brand logo', () => {
    const html = composeHtml({ doc: must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Logo3D', from: 0 }, 'l')), tokens: { ...FEEGA_TOKENS, logoUrl: 'https://x/logo.svg' }, assets: {} });
    expect(html).toContain('"url":"https://x/logo.svg"');
  });
});
