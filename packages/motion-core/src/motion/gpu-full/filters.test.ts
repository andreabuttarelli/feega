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

  it('drops every function that leaves the pixels as they are', () => {
    const noops = ['blur(0)', 'blur(0px)', 'blur()', 'drop-shadow(0 0 0 transparent)', 'drop-shadow(rgba(0, 0, 0, 0) 0px 0px 0px)', 'drop-shadow(3px 4px 8px rgb(0 0 0 / 0))', 'drop-shadow(0px 0px 0px #0000)', 'opacity(1)', 'opacity(100%)', 'brightness(1)', 'contrast(100%)', 'saturate(1)', 'grayscale(0)', 'sepia(0%)', 'invert(0)', 'hue-rotate(0deg)', 'hue-rotate(0)'];

    for (const noop of noops) {
      expect(cssFunctions(noop), noop).toEqual([]);
    }
  });

  it('keeps every function that changes the pixels', () => {
    const live = ['blur(0.5px)', 'drop-shadow(0 0 0 rgb(0, 0, 0))', 'drop-shadow(rgba(0, 0, 0, 0.2) 0px 1px 2px)', 'opacity(0.5)', 'brightness(1.2)', 'grayscale()', 'sepia(1)', 'hue-rotate(90deg)'];

    for (const fn of live) {
      expect(cssFunctions(fn), fn).toHaveLength(1);
    }
  });

  it('drops only the no-op parts of a chain', () => {
    expect(cssFunctions('blur(0px) brightness(1.2) opacity(1) sepia(0.5)')).toEqual([
      { name: 'brightness', args: ['1.2'] },
      { name: 'sepia', args: ['0.5'] }
    ]);
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

  it('lets the warp pass of bulge, twirl, radial and lens blur through', () => {
    expect(unsupportedPrimitive([{ tag: 'filter', attrs: {}, children: [{ tag: 'feWarp', attrs: { mode: 'twirl' } }] }])).toBeNull();
  });
});
