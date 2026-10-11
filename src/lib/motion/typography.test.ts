import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, setKeyframes, setProps, type OpResult } from './timeline';
import { FEEGA_TOKENS } from './brand';
import { composeHtml } from './hyperframes/compose';
import { setExpression } from './expression/ops';
import { fitSize } from './hyperframes/fit-runtime';
import { googleFontsUrl, usedFaces, type CatalogueFont } from './fonts/model';
import { setFont } from './fonts/ops';

const CATALOGUE: CatalogueFont[] = [
  { f: 'Inter', c: 'sans', w: [100, 200, 300, 400, 500, 600, 700, 800, 900], i: 1, a: [['opsz', 14, 32], ['wght', 100, 900]] },
  { f: 'Bebas Neue', c: 'display', w: [400], i: 0 }
];

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const doc = () => ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60 }, 'title'));
const compose = (d: MotionDoc) => composeHtml({ doc: d, tokens: FEEGA_TOKENS, assets: {} });

describe('rich typography', () => {
  it('text clips carry tracking, leading and variable axes with the look they had', () => {
    expect(findClip(doc(), 'title')!.clip.props).toMatchObject({ tracking: -0.05, leading: 0.95, stretch: 100, slant: 0, axes: '' });
    const text = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 30 }, 't'));
    expect(findClip(text, 't')!.clip.props).toMatchObject({ tracking: -0.01, leading: 1.3 });
  });

  it('static typography lands in the text style, with the requested size marked for the measured fit', () => {
    const html = compose(ok(setProps(doc(), 'title', { tracking: 0.1, leading: 1.2, stretch: 80, slant: -8, axes: "'GRAD' 50" })));

    expect(html).toContain('letter-spacing:0.1em;line-height:1.2');
    expect(html).toContain("font-variation-settings:'wdth' 80, 'slnt' -8, 'GRAD' 50");
    expect(html).toMatch(/data-fit="\d+(\.\d+)?"/);
  });

  it('a text case sets the letters upper or lower without retyping them', () => {
    expect(findClip(doc(), 'title')!.clip.props).toMatchObject({ textCase: 'as-typed' });
    expect(compose(doc())).not.toContain('text-transform');
    expect(compose(ok(setProps(doc(), 'title', { textCase: 'upper' })))).toContain('text-transform:uppercase');
    expect(compose(ok(setProps(doc(), 'title', { textCase: 'lower' })))).toContain('text-transform:lowercase');
  });

  it('refuses a malformed axes string', () => {
    expect(setProps(doc(), 'title', { axes: "'GRAD' 50; color: red" })).toMatchObject({ ok: false });
  });

  it('keyframed tracking and weight animate CSS variables the style reads', () => {
    let d = ok(setKeyframes(doc(), 'title', 'tracking', [{ frame: 0, value: 0.3, ease: Ease.Linear }, { frame: 30, value: -0.05, ease: Ease.Linear }]));
    d = ok(setExpression(d, 'title', 'weight', '300 + time * 200'));
    const html = compose(d);

    expect(html).toContain('letter-spacing:calc(var(--kc-tracking) * 1em)');
    expect(html).toContain('font-weight:var(--kc-weight)');
    expect(html).toMatch(/tl\.fromTo\("#ks-title",\{"--kc-tracking":"0\.3"\}/);
  });

  it('a variable family is requested with its axis ranges, so animated weight is smooth', () => {
    const d = ok(setFont(doc(), 'title', { family: 'Inter' }, CATALOGUE));
    expect(googleFontsUrl(usedFaces(d), d.fonts)).toBe('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=block');
  });

  it('the measured fit keeps a size that fits and shrinks one that does not, the same way every time', () => {
    const box = { width: 1000, height: 300 };
    const measure = (size: number) => ({ width: size * 8, height: size * 1.1 });

    expect(fitSize(100, measure, box)).toBe(100);
    const shrunk = fitSize(200, measure, box);
    expect(shrunk).toBeLessThanOrEqual(125);
    expect(shrunk * 8).toBeLessThanOrEqual(1000);
    expect(fitSize(200, measure, box)).toBe(shrunk);
  });

  it('built-in faces are loaded explicitly too, because hidden text never asks for its font and the fit would measure a fallback', () => {
    expect(compose(doc())).toContain('document.fonts.load("normal 600 1em \\"DM Sans\\"")');
  });

  it('the composition fits text after the fonts load and before anything waits on them', () => {
    expect(compose(doc())).toMatch(/__fontsReady=.*then\(function\(\)\{return document\.fonts\.ready;\}\)\.then\(FIT_TEXT\)/s);
  });
});
