import { describe, expect, it } from 'vitest';
import { Ease } from '../design';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { FEEGA_TOKENS } from '../brand';
import { composeHtml } from '../hyperframes/compose';
import { setExpression } from '../expression/ops';
import { AnimatorUnit, SelectorShape, animatorKey } from './model';
import { addAnimator, applyPreset, removeAnimator, setAnimator, TextPreset } from './ops';
import { selection, splitText } from './split';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const titled = () => ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 30, durationInFrames: 90, props: { text: 'Hello big\nworld' } }, 'title'));
const clipOf = (doc: MotionDoc) => findClip(doc, 'title')!.clip;
const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

describe('text splitting', () => {
  it('splits characters (not spaces) with their position, keeping words unbreakable', () => {
    const html = splitText('Hi yo', { unit: AnimatorUnit.Char, seed: null });

    expect(html).toBe('<span class="tw"><span class="tu" style="--p:0.125">H</span><span class="tu" style="--p:0.375">i</span></span> <span class="tw"><span class="tu" style="--p:0.625">y</span><span class="tu" style="--p:0.875">o</span></span>');
  });

  it('splits words and lines, and escapes markup', () => {
    expect(splitText('a <b>', { unit: AnimatorUnit.Word, seed: null })).toBe('<span class="tu" style="--p:0.25">a</span> <span class="tu" style="--p:0.75">&lt;b&gt;</span>');
    expect(splitText('one\ntwo', { unit: AnimatorUnit.Line, seed: null })).toBe('<span class="tu tl" style="--p:0.25">one</span>\n<span class="tu tl" style="--p:0.75">two</span>');
  });

  it('a seed shuffles the order deterministically', () => {
    const a = splitText('abcdefgh', { unit: AnimatorUnit.Char, seed: 7 });
    expect(a).toBe(splitText('abcdefgh', { unit: AnimatorUnit.Char, seed: 7 }));
    expect(a).not.toBe(splitText('abcdefgh', { unit: AnimatorUnit.Char, seed: null }));
    expect(a).not.toBe(splitText('abcdefgh', { unit: AnimatorUnit.Char, seed: 8 }));
  });
});

describe('the range selector', () => {
  it('square selects the units inside start..end shifted by offset', () => {
    const at = (p: number) => selection({ shape: SelectorShape.Square, start: 0, end: 50, offset: 0, softness: 0 }, p);
    expect([at(0.1), at(0.4), at(0.6)]).toEqual([1, 1, 0]);
    expect(selection({ shape: SelectorShape.Square, start: 0, end: 50, offset: 25, softness: 0 }, 0.6)).toBe(1);
  });

  it('ramp and smooth soften the edges; smooth eases them', () => {
    const ramp = selection({ shape: SelectorShape.Ramp, start: 50, end: 100, offset: 0, softness: 0.2 }, 0.55);
    const smooth = selection({ shape: SelectorShape.Smooth, start: 50, end: 100, offset: 0, softness: 0.2 }, 0.55);
    expect(ramp).toBeCloseTo(0.25);
    expect(smooth).toBeCloseTo(0.25 * 0.25 * (3 - 0.5));
  });
});

describe('text animators', () => {
  it('add, edit, remove; a parse round trip keeps them; removing drops their keyframes', () => {
    let doc = ok(addAnimator(titled(), 'title', 'a1', { unit: AnimatorUnit.Char, shape: SelectorShape.Smooth, values: { opacity: 0, y: 0.4, blur: 8 } }));
    doc = ok(setAnimator(doc, 'title', 'a1', { offset: 20, values: { rotation: 15 } }));
    expect(parseMotionDoc(JSON.parse(JSON.stringify(doc))).ok).toBe(true);
    expect(clipOf(doc).animators[0]).toMatchObject({ id: 'a1', unit: 'char', shape: 'smooth', offset: 20, values: { opacity: 0, y: 0.4, blur: 8, rotation: 15 } });

    doc = ok(setKeyframes(doc, 'title', animatorKey('a1', 'offset'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 30, value: 120, ease: Ease.Linear }]));
    doc = ok(removeAnimator(doc, 'title', 'a1'));
    expect(clipOf(doc)).toMatchObject({ animators: [], keyframes: {} });
  });

  it('refuses animators on clips without text, and out-of-range values', () => {
    const shape = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 's'));
    expect(addAnimator(shape, 's', 'a', { unit: AnimatorUnit.Word })).toMatchObject({ ok: false });
    expect(addAnimator(titled(), 'title', 'a', { unit: AnimatorUnit.Word, values: { opacity: 3 } })).toMatchObject({ ok: false });
  });

  it('composes split spans whose style is a pure CSS function of the selector variables, so any frame is a seek', () => {
    const doc = ok(addAnimator(titled(), 'title', 'a1', { unit: AnimatorUnit.Char, shape: SelectorShape.Ramp, values: { opacity: 0, y: 0.5, blur: 6 } }));
    const html = compose(doc);

    expect(html).toContain('id="ta-title"');
    expect(html).toContain('--ta-a1-start:0');
    expect(html).toContain('class="tu" style="--p:');
    expect(html).toMatch(/#ta-title \.tu\{[^}]*--in0:clamp\(0,/);
    expect(html).toMatch(/opacity:calc\(1 - var\(--a0\) \* \(1 - var\(--ta-a1-opacity\)\)\)/);
  });

  it('keyframed and expression-driven selector values become timeline lanes on the text', () => {
    let doc = ok(addAnimator(titled(), 'title', 'a1', { unit: AnimatorUnit.Word, values: { y: 0 } }));
    doc = ok(setKeyframes(doc, 'title', animatorKey('a1', 'offset'), [{ frame: 0, value: -100, ease: Ease.Linear }, { frame: 30, value: 100, ease: Ease.Linear }]));
    doc = ok(setExpression(doc, 'title', animatorKey('a1', 'y'), 'Math.sin(time * 4) * 0.2'));
    const html = compose(doc);

    expect(html).toMatch(/tl\.fromTo\("#ta-title",\{"--ta-a1-offset":-100\}/);
    expect(html).toMatch(/"--ta-a1-y":/);
  });

  it('presets: blur-up per character, word stagger, line mask-up', () => {
    const blur = ok(applyPreset(titled(), 'title', TextPreset.BlurUp, { start: 0, duration: 30 }, 'p1'));
    expect(clipOf(blur).animators[0]).toMatchObject({ unit: 'char', values: { opacity: 0, blur: expect.any(Number) } });
    expect(clipOf(blur).keyframes[animatorKey('p1', 'offset')]).toHaveLength(2);

    const words = ok(applyPreset(titled(), 'title', TextPreset.WordStagger, { start: 0, duration: 30 }, 'p2'));
    expect(clipOf(words).animators[0]).toMatchObject({ unit: 'word' });

    const lines = ok(applyPreset(titled(), 'title', TextPreset.LineMaskUp, { start: 0, duration: 30 }, 'p3'));
    expect(clipOf(lines).animators[0]).toMatchObject({ unit: 'line', values: { y: 1.2 } });
    expect(compose(lines)).toContain('tl');
  });
});

describe('a preset sweeps over the units the text really has', () => {
  const STEPS = 24;
  const MAX_STEP = 0.15;

  function amounts(text: string, preset: TextPreset): number[] {
    const doc = ok(applyPreset(ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60, props: { text } }, 'title')), 'title', preset, { start: 0, duration: STEPS }, 'p'));
    const clip = clipOf(doc);
    const [from, to] = clip.keyframes[animatorKey('p', 'offset')].map((k) => k.value as number);
    const a = clip.animators[0];
    return Array.from({ length: STEPS + 1 }, (_, i) => selection({ ...a, offset: from + ((to - from) * i) / STEPS }, 0.5));
  }

  it('a one-line mask-up moves across the whole span, not in a few frames of it', () => {
    const steps = amounts('code.', TextPreset.LineMaskUp);
    const jumps = steps.slice(1).map((v, i) => steps[i] - v);

    expect(steps[0]).toBe(1);
    expect(steps.at(-1)).toBe(0);
    expect(Math.max(...jumps)).toBeLessThan(MAX_STEP);
    expect(jumps.every((j) => j >= 0)).toBe(true);
  });
});

describe('animators with different units on one clip', () => {
  it('a char preset and a per-word colour live together: the text splits by char and each char also knows its word', () => {
    let doc = ok(addAnimator(titled(), 'title', 'a1', { unit: AnimatorUnit.Char, values: { opacity: 0, blur: 8 } }));
    doc = ok(addAnimator(doc, 'title', 'a2', { unit: AnimatorUnit.Word, shape: SelectorShape.Square, values: { color: '#0099ff' } }));
    const html = compose(doc);

    expect(html).toMatch(/class="tu" style="--p:[0-9.]+;--pw:[0-9.]+"/);
    expect(html).toMatch(/--in1:clamp\(0, \(var\(--pw\)/);
    expect(html).toMatch(/--in0:clamp\(0, \(var\(--p\)/);
  });

  it('every char of a word shares that word\'s position', () => {
    const html = splitText('ab cd', { unit: AnimatorUnit.Char, seed: null, coarser: [AnimatorUnit.Word] });

    expect(html).toContain('style="--p:0.125;--pw:0.25">a<');
    expect(html).toContain('style="--p:0.375;--pw:0.25">b<');
    expect(html).toContain('style="--p:0.625;--pw:0.75">c<');
  });
});
