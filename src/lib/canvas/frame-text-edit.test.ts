import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { ListKind } from '$lib/motion/text-lists';
import { commitText, editCss, editLayout, editsText, gradientSpans, hideText, listsOfClip, runsOfClip, textEditStyle } from './frame-text-edit';
import type { TextCaret } from '$lib/motion/gpu-full/display-list';

function withText() {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Hello', size: 0.1 } }, 'title');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const textOf = (doc: ReturnType<typeof withText>) => findClip(doc, 'title')!.clip.props.text;

describe('text editing inside a core frame', () => {
  it('opens only on a text clip', () => {
    const shape = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect' } }, 'box');
    if (!shape.ok) {
      throw new Error(shape.error);
    }

    expect(editsText(withText(), 'title')).toBe(true);
    expect(editsText(shape.doc, 'box')).toBe(false);
    expect(editsText(withText(), 'missing')).toBe(false);
  });

  it('hides only the glyphs of the edited clip while the caret is open', () => {
    expect(textOf(hideText(withText(), 'title'))).toBe('');
    expect(textOf(withText())).toBe('Hello');
  });

  it('commits the typed text as an op the history can take back', () => {
    const result = commitText(withText(), 'title', 'Bye');

    expect(result.ok && textOf(result.doc)).toBe('Bye');
  });

  it('commits styled ranges with the text, so bold survives the edit', () => {
    const result = commitText(withText(), 'title', 'Hello you', [{ start: 6, end: 9, weight: 700 }]);
    const clip = result.ok ? findClip(result.doc, 'title')!.clip : null;

    expect(clip && runsOfClip(clip)).toEqual([{ start: 6, end: 9, weight: 700 }]);
  });

  it('commits the lists with the text and drops them when none is left', () => {
    const listed = commitText(withText(), 'title', 'Hello\nyou', [], [{ kind: ListKind.Bullet, level: 0 }]);
    const clip = listed.ok ? findClip(listed.doc, 'title')!.clip : null;

    expect(clip && listsOfClip(clip)).toEqual([{ kind: 'bullet', level: 0 }]);
    const cleared = commitText(listed.ok ? listed.doc : withText(), 'title', 'Hello\nyou', [], []);
    expect(cleared.ok && listsOfClip(findClip(cleared.doc, 'title')!.clip)).toEqual([]);
  });

  it('a text kind without styled ranges commits the text alone', () => {
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Kicker', from: 0, durationInFrames: 90, props: { text: 'k' } }, 'k');
    if (!added.ok) {
      throw new Error(added.error);
    }

    expect(commitText(added.doc, 'k', 'kk', [{ start: 0, end: 1, weight: 700 }]).ok).toBe(true);
  });

  it('sizes the caret font from the frame unit and the screen scale', () => {
    const doc = withText();
    const style = textEditStyle({ clip: findClip(doc, 'title')!.clip, doc, tokens: FEEGA_TOKENS, frame: { width: 1920, height: 1080 }, scale: 0.5 });

    expect(style.fontPx).toBeCloseTo(0.1 * 1080 * 0.5);
    expect(style.family).toContain('DM Sans');
    expect(style.align).toBe('center');
  });

  it('fills the defaults a seeded clip leaves out', () => {
    const doc = withText();
    const bare = { ...findClip(doc, 'title')!.clip, props: { text: 'Hi', size: 0.1 } } as never;
    const style = textEditStyle({ clip: bare, doc, tokens: FEEGA_TOKENS, frame: { width: 1920, height: 1080 }, scale: 1 });

    expect(Number.isFinite(style.weight) && Number.isFinite(style.leading) && Number.isFinite(style.trackingEm)).toBe(true);
  });
});

describe('the editing box follows the drawn text', () => {
  const caret = (over: Partial<TextCaret>): TextCaret => ({ lines: [], matrix: [1, 0, 0, 1, 100, 50], text: 'Hi', paragraphs: ['Hi'], flow: { spaces: 'keep', wraps: true } as TextCaret['flow'], width: 300, height: 80, size: 40, vertical: 0.5, ...over });
  const look = { fontPx: 99, family: 'Inter', weight: 400, italic: false, trackingEm: 0, leading: 1.2, color: '#000', textTransform: 'none', align: 'left', wrap: 'auto', trim: 'normal', decoration: '' };

  it('lays the box out in stage pixels and maps it to the screen in one transform', () => {
    const laid = editLayout(caret({}), [0.5, 0, 0, 0.5, 10, 20]);

    expect(laid.transform).toBe('matrix(0.5,0,0,0.5,60,45)');
    expect(laid.fontPx).toBe(40);
    expect(laid.width).toBe(300);
  });

  it('a text that does not wrap keeps one line per paragraph and grows sideways', () => {
    const css = editCss(look, editLayout(caret({ flow: { spaces: 'keep', wraps: false } as TextCaret['flow'], vertical: 0 }), [1, 0, 0, 1, 0, 0]));

    expect(css).toContain('white-space:pre;');
    expect(css).not.toContain('width:300px');
  });

  it('a wrapping text wraps at the drawn width with the drawn alignment', () => {
    const css = editCss(look, editLayout(caret({}), [1, 0, 0, 1, 0, 0]));

    expect(css).toContain('white-space:pre-wrap;');
    expect(css).toContain('width:300px');
    expect(css).toContain('text-align:left');
    expect(css).toContain('font:400 40px/1.2 Inter');
  });

  it('resolves px line height and % letter spacing against the type size', () => {
    const doc = withText();
    const clip = findClip(doc, 'title')!.clip;
    const style = textEditStyle({ clip: { ...clip, props: { ...clip.props, lineHeight: '216px', letterSpacing: '10%' } }, doc, tokens: FEEGA_TOKENS, frame: { width: 1920, height: 1080 }, scale: 1 });

    expect(style.leading).toBeCloseTo(2);
    expect(style.trackingEm).toBeCloseTo(0.1);
  });

  it('balances and trims the way the canvas draws', () => {
    const css = editCss({ ...look, wrap: 'balance', trim: 'trim-both cap alphabetic' }, editLayout(caret({}), [1, 0, 0, 1, 0, 0]));

    expect(css).toContain('text-wrap-style:balance');
    expect(css).toContain('text-box:trim-both cap alphabetic');
  });

  it('underlines and sets features the way the canvas draws', () => {
    const doc = withText();
    const clip = findClip(doc, 'title')!.clip;
    const style = textEditStyle({ clip: { ...clip, props: { ...clip.props, decoration: 'underline', features: "'tnum' 1" } }, doc, tokens: FEEGA_TOKENS, frame: { width: 1920, height: 1080 }, scale: 1 });
    const css = editCss(style, editLayout(caret({}), [1, 0, 0, 1, 0, 0]));

    expect(css).toContain('text-decoration-line:underline');
    expect(css).toContain("font-feature-settings:'tnum' 1");
  });

  it('title-cases and justifies the way the canvas draws', () => {
    const css = editCss({ ...look, textTransform: 'capitalize', align: 'justify' }, editLayout(caret({}), [1, 0, 0, 1, 0, 0]));

    expect(css).toContain('text-transform:capitalize');
    expect(css).toContain('text-align:justify');
  });
});

describe('gradientSpans', () => {
  const fill = { type: 'linear-gradient', angle: 90, opacity: 1, visible: true, blend: 'normal', stops: [{ pos: 0, color: '#ff0000', opacity: 1 }, { pos: 1, color: '#0000ff', opacity: 1 }] } as never;

  it('is empty while no range carries a gradient', () => {
    expect(gradientSpans('Hello world', [{ start: 6, end: 11, color: '#fff' }])).toEqual([]);
  });

  it('splits the text at the gradient range and paints only that range', () => {
    const spans = gradientSpans('Hello world', [{ start: 6, end: 11, fill }]);

    expect(spans.map((s) => s.text)).toEqual(['Hello ', 'world']);
    expect(spans[0].style).toBe('');
    expect(spans[1].style).toContain('linear-gradient');
    expect(spans[1].style).toContain('background-clip:text');
  });
});
