import { describe, expect, it } from 'vitest';
import { chain, cssAffine, cssFilters, cssMasks, cssRgba, EffectKind, joinRasters, IDENTITY, MaskComposite, type FilterStep } from './layer-tree';

describe('chain', () => {
  it('applies the inner affine first, then the outer', () => {
    const move = chain([1, 0, 0, 1, 10, 0], [2, 0, 0, 2, 0, 0]);
    expect(move).toEqual([2, 0, 0, 2, 10, 0]);
  });
});

describe('cssAffine', () => {
  it('is the identity without a transform', () => {
    expect(cssAffine('none', '0px 0px')).toEqual(IDENTITY);
  });

  it('turns about the transform origin, not the corner', () => {
    const [a, b, c, d, e, f] = cssAffine('matrix(0, 1, -1, 0, 0, 0)', '50px 50px') as number[];
    expect([a, b, c, d]).toEqual([0, 1, -1, 0]);
    expect([e, f]).toEqual([100, 0]);
  });

  it('refuses a 3D matrix', () => {
    expect(cssAffine('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)', '0px 0px')).toBeNull();
  });
});

describe('cssRgba', () => {
  it('reads a computed colour as straight 0..1 channels', () => {
    expect(cssRgba('rgb(255, 0, 51)')).toEqual([1, 0, 0.2, 1]);
    expect(cssRgba('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5]);
  });

  it('has nothing to paint for a transparent colour', () => {
    expect(cssRgba('rgba(0, 0, 0, 0)')).toBeNull();
    expect(cssRgba('transparent')).toBeNull();
  });
});

describe('joinRasters', () => {
  it('rasterises neighbouring DOM-only siblings in one pass, never across a GPU layer', () => {
    const gpu = { gpu: 'x' };
    expect(joinRasters([{ raster: ['a'] }, null, { raster: ['b'] }, gpu, { raster: ['c'] }])).toEqual([{ raster: ['a', 'b'] }, gpu, { raster: ['c'] }]);
  });
});

describe('cssMasks', () => {
  const a = 'data:image/svg+xml;charset=utf-8,%3Cg%20filter%3D%22url(%23kl)%22%2F%3E';
  const b = 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E';

  it('reads frozen mask images top first, with the composite of each layer', () => {
    expect(cssMasks(`url("${a}"), url("${b}")`, 'subtract, add')).toEqual([
      { url: a, composite: MaskComposite.Subtract },
      { url: b, composite: MaskComposite.Add }
    ]);
  });

  it('understands the WebKit names of the composites', () => {
    expect(cssMasks(`url("${a}"), url("${b}")`, 'source-out, source-over').map((m) => m.composite)).toEqual([MaskComposite.Subtract, MaskComposite.Add]);
    expect(cssMasks(`url("${a}"), url("${b}")`, 'xor, source-in').map((m) => m.composite)).toEqual([MaskComposite.Exclude, MaskComposite.Intersect]);
  });

  it('repeats a short composite list, as CSS does', () => {
    expect(cssMasks(`url("${a}"), url("${b}")`, 'intersect').map((m) => m.composite)).toEqual([MaskComposite.Intersect, MaskComposite.Intersect]);
  });

  it('has nothing to read without a mask, and refuses a mask that is not a frozen picture', () => {
    expect(cssMasks('none', 'add')).toEqual([]);
    expect(cssMasks('url("#mk-a")', 'add')).toBeNull();
    expect(cssMasks('linear-gradient(red, blue)', 'add')).toBeNull();
  });
});

describe('cssFilters', () => {
  const grain = (seed: number): FilterStep => ({ kind: EffectKind.Grain, grain: { baseFrequency: 1, seed, amount: 0.2 } });
  const known: Record<string, FilterStep> = { g1: grain(1), g2: grain(2), soft: { kind: EffectKind.Blur, sigma: 6 } };
  const lookup = (id: string) => known[id] ?? null;

  it('has nothing to do without a filter', () => {
    expect(cssFilters('none', lookup)).toEqual([]);
  });

  it('reads a CSS blur in pixels', () => {
    expect(cssFilters('blur(25px)', lookup)).toEqual([{ kind: EffectKind.Blur, sigma: 25 }]);
  });

  it('keeps the order of the chain, joining neighbouring grains in one pass', () => {
    expect(cssFilters('url("#g1") url("#g2") blur(4px) url(#soft)', lookup)).toEqual([
      { kind: EffectKind.Grain, grains: [{ baseFrequency: 1, seed: 1, amount: 0.2 }, { baseFrequency: 1, seed: 2, amount: 0.2 }] },
      { kind: EffectKind.Blur, sigma: 4 },
      { kind: EffectKind.Blur, sigma: 6 }
    ]);
  });

  it('passes a liquid-glass lens through as one step', () => {
    const glass: FilterStep = { kind: EffectKind.Glass, glass: { href: 'data:image/png;base64,AA', map: [1, 2, 3, 4], box: [0, 1, 5, 6], smooth: [2, 2], scale: 9, frost: 3 } };
    expect(cssFilters('url("#lens")', (id) => (id === 'lens' ? glass : null))).toEqual([glass]);
  });

  it('refuses what it cannot draw: another CSS function or an unknown SVG filter', () => {
    expect(cssFilters('brightness(1.2)', lookup)).toBeNull();
    expect(cssFilters('url("#other")', lookup)).toBeNull();
    expect(cssFilters('blur(2px) saturate(2)', lookup)).toBeNull();
  });
});
