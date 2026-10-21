import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { commitText, editsText, hideText, textEditStyle } from './frame-text-edit';

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

  it('sizes the caret font from the frame unit and the screen scale', () => {
    const doc = withText();
    const style = textEditStyle({ clip: findClip(doc, 'title')!.clip, doc, tokens: FEEGA_TOKENS, frame: { width: 1920, height: 1080 }, scale: 0.5 });

    expect(style.fontPx).toBeCloseTo(0.1 * 1080 * 0.5);
    expect(style.family).toContain('DM Sans');
  });
});
