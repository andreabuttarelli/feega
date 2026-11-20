import { describe, expect, it } from 'vitest';
import { FillKind, newFill, parseFills } from './fills';
import { TEXT_GRADIENT_REFUSAL, previewCss, textFillCss, textFillPreviews, textFillRefusal, textFillWrites, textFillsOf } from './text-fill';

const RED = 'rgb(255, 0, 0)';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const GRADIENT = 'linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)';

const plain = { color: RED, 'background-image': 'none', 'background-color': TRANSPARENT, 'background-clip': 'border-box' };
const gradient = { color: TRANSPARENT, 'background-image': GRADIENT, 'background-color': TRANSPARENT, 'background-clip': 'text' };

describe('textFillsOf', () => {
  it('plain text is one solid layer from its colour', () => {
    expect(textFillsOf(plain)).toEqual([{ kind: FillKind.Solid, colour: RED, visible: true }]);
  });

  it('text clipped to its background shows the background layers', () => {
    expect(textFillsOf(gradient).map((f) => f.kind)).toEqual([FillKind.Linear]);
  });

  it('the webkit-prefixed clip counts too', () => {
    const styles = { ...gradient, 'background-clip': 'border-box', '-webkit-background-clip': 'text' };

    expect(textFillsOf(styles).map((f) => f.kind)).toEqual([FillKind.Linear]);
  });
});

describe('textFillCss', () => {
  it('solid only stays a plain colour and drops the clip and the layers', () => {
    const css = textFillCss(parseFills('none', RED));

    expect(css).toMatchObject({ color: RED, 'background-clip': '', 'background-image': '', 'background-color': '' });
  });

  it('a gradient clips the background to the text and clears the colour', () => {
    const css = textFillCss(parseFills(GRADIENT, TRANSPARENT));

    expect(css).toMatchObject({ color: 'transparent', 'background-clip': 'text', 'background-image': GRADIENT });
  });

  it('a solid beside a gradient goes under it as the background colour', () => {
    const css = textFillCss(parseFills(GRADIENT, RED));

    expect(css).toMatchObject({ color: 'transparent', 'background-color': RED, 'background-clip': 'text' });
  });

  it('an image layer carries its placement', () => {
    const css = textFillCss([{ ...newFill(FillKind.Image), url: '/a.png' }]);

    expect(css).toMatchObject({ 'background-image': 'url("/a.png")', 'background-size': 'cover', 'background-repeat': 'no-repeat', 'background-position': '50% 50%' });
  });

  it('no layers at all leaves the colour to the cascade', () => {
    expect(textFillCss([])).toMatchObject({ color: '', 'background-clip': '' });
  });
});

describe('textFillWrites', () => {
  const names = (css: Record<string, string>, styles: Record<string, string>) => textFillWrites(css, styles).map(([row]) => row);

  it('changing the solid colour writes only the colour', () => {
    const css = textFillCss(parseFills('none', 'rgb(0, 0, 255)'));

    expect(names(css, plain)).toEqual(['color']);
  });

  it('adding a gradient writes the layers, the clip and a transparent colour', () => {
    const css = textFillCss(parseFills(GRADIENT, TRANSPARENT));

    expect(names(css, plain)).toEqual(['fill-image', 'text-clip', 'color']);
  });

  it('removing the gradient restores the colour and drops the clip and the layers', () => {
    const css = textFillCss(parseFills('none', RED));

    expect(textFillWrites(css, gradient)).toEqual([
      ['fill-image', ''],
      ['text-clip', ''],
      ['color', RED]
    ]);
  });

  it('an untouched gradient writes nothing', () => {
    const css = textFillCss(textFillsOf(gradient));

    expect(names(css, gradient)).toEqual([]);
  });
});

describe('textFillRefusal', () => {
  const next = [newFill(FillKind.Linear)];

  it('an element with its own background cannot take a text gradient', () => {
    const styles = { ...plain, 'background-color': 'rgb(10, 10, 10)' };

    expect(textFillRefusal(styles, next)).toBe(TEXT_GRADIENT_REFUSAL);
    expect(TEXT_GRADIENT_REFUSAL).toBe('this element has a background; wrap the text in a span to give it a gradient');
  });

  it('a background image is a background too', () => {
    expect(textFillRefusal({ ...plain, 'background-image': GRADIENT }, next)).toBe(TEXT_GRADIENT_REFUSAL);
  });

  it('plain text takes a gradient', () => {
    expect(textFillRefusal(plain, next)).toBeNull();
  });

  it('text already clipped keeps taking layers', () => {
    expect(textFillRefusal(gradient, next)).toBeNull();
  });

  it('solid only is never refused', () => {
    const styles = { ...plain, 'background-color': 'rgb(10, 10, 10)' };

    expect(textFillRefusal(styles, parseFills('none', RED))).toBeNull();
  });
});

describe('previewCss', () => {
  it('an emptied property previews as its default', () => {
    expect(previewCss({ color: RED, 'background-image': '', 'background-color': '', 'background-clip': '' })).toEqual({ color: RED, 'background-image': 'none', 'background-color': 'transparent', 'background-clip': 'border-box' });
  });
});

describe('textFillPreviews', () => {
  it('names the row each preview goes to, with defaults for emptied ones', () => {
    expect(textFillPreviews({ 'background-clip': '', color: RED })).toEqual([
      ['text-clip', 'border-box'],
      ['color', RED]
    ]);
  });
});
