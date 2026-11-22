import { describe, expect, it } from 'vitest';
import { Unit, UNITS_OF, Length, convert, cssOf, isKeyword, parseLength, stepOf } from './units';

const context = { rem: 16, em: 20, parent: 400, viewport: { w: 1000, h: 800 } };

describe('parseLength', () => {
  it('reads a typed value with its unit', () => {
    expect(parseLength('2rem', Unit.Px)).toEqual({ value: 2, unit: Unit.Rem });
    expect(parseLength('50%', Unit.Px)).toEqual({ value: 50, unit: Unit.Percent });
  });

  it('a bare number keeps the current unit', () => {
    expect(parseLength('12', Unit.Rem)).toEqual({ value: 12, unit: Unit.Rem });
  });

  it('auto is a value of its own', () => {
    expect(parseLength('auto', Unit.Px)).toEqual({ value: 0, unit: Unit.Auto });
  });
});

describe('size keywords and viewport units', () => {
  it.each([
    ['none', Unit.Unlimited],
    ['fit-content', Unit.FitContent],
    ['min-content', Unit.MinContent],
    ['max-content', Unit.MaxContent]
  ])('%s is a value of its own', (text, unit) => {
    expect(parseLength(text, Unit.Px)).toEqual({ value: 0, unit });
    expect(cssOf({ value: 0, unit })).toBe(text);
  });

  it('reads dvh and ch', () => {
    expect(parseLength('100dvh', Unit.Px)).toEqual({ value: 100, unit: Unit.Dvh });
    expect(parseLength('65ch', Unit.Px)).toEqual({ value: 65, unit: Unit.Ch });
  });

  it('a keyword converts to no number', () => {
    expect(convert({ value: 0, unit: Unit.FitContent }, Unit.Px, context)).toEqual({ value: 0, unit: Unit.Px });
    expect(isKeyword(Unit.FitContent)).toBe(true);
    expect(isKeyword(Unit.Px)).toBe(false);
  });

  it('dvh follows the preview height', () => {
    expect(convert({ value: 400, unit: Unit.Px }, Unit.Dvh, context)).toEqual({ value: 50, unit: Unit.Dvh });
  });

  it('max sizes offer none, min sizes do not', () => {
    expect(UNITS_OF['max-width']).toContain(Unit.Unlimited);
    expect(UNITS_OF['max-height']).toContain(Unit.Unlimited);
    expect(UNITS_OF['min-width']).not.toContain(Unit.Unlimited);
    expect(UNITS_OF['min-height']).toContain(Unit.Auto);
  });

  it.each(['min-width', 'max-width', 'min-height', 'max-height'])('%s takes every length unit and the content keywords', (name) => {
    expect(UNITS_OF[name]).toEqual(expect.arrayContaining([Unit.Px, Unit.Percent, Unit.Rem, Unit.Em, Unit.Vw, Unit.Vh, Unit.Dvh, Unit.Ch, Unit.FitContent, Unit.MinContent, Unit.MaxContent]));
  });

  it('width and height take fit-content', () => {
    expect(UNITS_OF.width).toEqual(expect.arrayContaining([Unit.Auto, Unit.FitContent]));
    expect(UNITS_OF.height).toEqual(expect.arrayContaining([Unit.Auto, Unit.FitContent]));
  });
});

describe('convert', () => {
  const px = (value: number): Length => ({ value, unit: Unit.Px });

  it('px to rem uses the page root font size', () => {
    expect(convert(px(24), Unit.Rem, context)).toEqual({ value: 1.5, unit: Unit.Rem });
  });

  it('px to percent uses the parent size', () => {
    expect(convert(px(100), Unit.Percent, context)).toEqual({ value: 25, unit: Unit.Percent });
  });

  it('vw and vh use the preview viewport', () => {
    expect(convert(px(500), Unit.Vw, context)).toEqual({ value: 50, unit: Unit.Vw });
    expect(convert(px(400), Unit.Vh, context)).toEqual({ value: 50, unit: Unit.Vh });
  });

  it('rem back to px', () => {
    expect(convert({ value: 2, unit: Unit.Rem }, Unit.Px, context)).toEqual(px(32));
  });
});

describe('units per property', () => {
  it('margin allows auto, padding does not', () => {
    expect(UNITS_OF.margin).toContain(Unit.Auto);
    expect(UNITS_OF.padding).not.toContain(Unit.Auto);
  });

  it('line height can be unitless, letter spacing defaults to em', () => {
    expect(UNITS_OF['line-height']).toContain(Unit.None);
    expect(UNITS_OF['letter-spacing'][0]).toBe(Unit.Em);
  });

  it('the scrub step follows the unit', () => {
    expect(stepOf(Unit.Px)).toBe(1);
    expect(stepOf(Unit.Rem)).toBe(0.125);
  });
});
