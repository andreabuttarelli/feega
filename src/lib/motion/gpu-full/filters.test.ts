import { describe, expect, it } from 'vitest';
import { cssFunctions, cssMatrix, tableAt, unsupportedPrimitive, IDENTITY_MATRIX } from './filters';

describe('cssFunctions', () => {
  it('splits a CSS filter list into functions and arguments', () => {
    expect(cssFunctions('brightness(1.2) drop-shadow(3px -4px 8px rgba(0,0,0,0.5)) blur(2px)')).toEqual([
      { name: 'brightness', args: ['1.2'] },
      { name: 'drop-shadow', args: ['3px', '-4px', '8px', 'rgba(0,0,0,0.5)'] },
      { name: 'blur', args: ['2px'] }
    ]);
    expect(cssFunctions('')).toEqual([]);
  });
});

describe('cssMatrix', () => {
  it('builds the W3C colour matrices', () => {
    expect(cssMatrix('brightness', 2)?.slice(0, 5)).toEqual([2, 0, 0, 0, 0]);
    expect(cssMatrix('contrast', 2)?.slice(0, 5)).toEqual([2, 0, 0, 0, -0.5]);
    expect(cssMatrix('grayscale', 0)).toEqual(IDENTITY_MATRIX);
    expect(cssMatrix('saturate', 1)?.map((v) => Math.round(v * 1000) / 1000)).toEqual(IDENTITY_MATRIX);
    expect(cssMatrix('hue-rotate', 0)?.map((v) => Math.round(v * 1000) / 1000)).toEqual(IDENTITY_MATRIX);
    expect(cssMatrix('blur', 1)).toBeNull();
  });
});

describe('tableAt', () => {
  it('interpolates a component-transfer table as SVG does', () => {
    expect(tableAt([0, 1], 0.25)).toBeCloseTo(0.25);
    expect(tableAt([0, 0.5, 1], 0.75)).toBeCloseTo(0.75);
    expect(tableAt([1, 0], 1)).toBe(0);
  });
});

describe('unsupportedPrimitive', () => {
  it('names a primitive the GPU interpreter has no pass for', () => {
    expect(unsupportedPrimitive([{ tag: 'filter', attrs: {}, children: [{ tag: 'feSpecularLighting', attrs: {} }] }])).toBe('feSpecularLighting');
    expect(unsupportedPrimitive([{ tag: 'filter', attrs: {}, children: [{ tag: 'feOffset', attrs: {} }] }])).toBeNull();
  });
});
