import { describe, expect, it } from 'vitest';
import { EFFECTS, EffectKind, defaultValues, type SvgNode, type Values } from './registry';

const frame = { width: 400, height: 200, frame: 0, fps: 30 };
const NEW_KINDS = [EffectKind.DisplacementMap, EffectKind.RadialBlur, EffectKind.LensBlur, EffectKind.Bulge, EffectKind.Twirl, EffectKind.Sharpen, EffectKind.ChromaKey];

const values = (kind: EffectKind, over: Values = {}): Values => ({ ...defaultValues(kind), ...over });
const primitives = (kind: EffectKind, over: Values = {}): SvgNode[] => EFFECTS[kind].render(values(kind, over), frame, 'f', null).nodes[0].children ?? [];
const tags = (nodes: SvgNode[]) => nodes.map((n) => n.tag);
const warp = (kind: EffectKind, over: Values = {}) => primitives(kind, over).find((n) => n.tag === 'feWarp')!.attrs;

describe('effects After Effects has and feega lacked', () => {
  it('displacement map moves the layer by its own luminance', () => {
    const nodes = primitives(EffectKind.DisplacementMap, { amount: 30 });

    expect(tags(nodes)).toEqual(['feColorMatrix', 'feDisplacementMap']);
    expect(nodes[1].attrs).toMatchObject({ scale: 30, xChannelSelector: 'R', yChannelSelector: 'G' });
    expect(EFFECTS[EffectKind.DisplacementMap].reach!(values(EffectKind.DisplacementMap, { amount: 30 }))).toBe(15);
  });

  it('radial blur zooms or spins around a centre given as a share of the layer', () => {
    expect(warp(EffectKind.RadialBlur, { centerX: 0.25, centerY: 0.75, zoom: 0.2, spin: 0 })).toMatchObject({ mode: 'radial', cx: 0.25, cy: 0.75, amount: 0.2, spin: 0 });
    expect(warp(EffectKind.RadialBlur, { spin: 10 })).toMatchObject({ mode: 'radial', spin: 10 });
  });

  it('lens blur is a disc of radius px that favours highlights', () => {
    expect(warp(EffectKind.LensBlur, { radius: 14, highlights: 2 })).toMatchObject({ mode: 'lens', amount: 14, boost: 2 });
    expect(EFFECTS[EffectKind.LensBlur].reach!(values(EffectKind.LensBlur, { radius: 14 }))).toBe(14);
  });

  it('bulge and twirl are warps limited to a radius', () => {
    expect(warp(EffectKind.Bulge, { radius: 90, amount: 0.6 })).toMatchObject({ mode: 'bulge', radius: 90, amount: 0.6 });
    expect(warp(EffectKind.Twirl, { radius: 120, angle: 90 })).toMatchObject({ mode: 'twirl', radius: 120, amount: 90 });
  });

  it('sharpen subtracts a blurred copy: source * (1 + amount) - blur * amount', () => {
    const nodes = primitives(EffectKind.Sharpen, { amount: 1.5, radius: 3 });

    expect(tags(nodes)).toEqual(['feGaussianBlur', 'feComposite']);
    expect(nodes[0].attrs.stdDeviation).toBe(3);
    expect(nodes[1].attrs).toMatchObject({ operator: 'arithmetic', in: 'SourceGraphic', in2: 'soft', k2: 2.5, k3: -1.5 });
  });

  it('chroma key turns the key colour transparent and pulls its spill out of what stays', () => {
    const nodes = primitives(EffectKind.ChromaKey, { key: '#00ff00', tolerance: 0.2, softness: 0.1, spill: 0.8 });
    const keyed = nodes.find((n) => n.attrs.result === 'keyed')!;
    const alphaRow = String(keyed.attrs.values).split(' ').map(Number).slice(15, 18);

    expect(alphaRow[1]).toBeLessThan(0);
    expect(alphaRow[0]).toBeGreaterThan(0);
    expect(nodes.some((n) => n.attrs.result === 'spill')).toBe(true);
  });

  it('chroma key without spill suppression leaves colours alone', () => {
    expect(primitives(EffectKind.ChromaKey, { spill: 0 }).some((n) => n.attrs.result === 'spill')).toBe(false);
  });

  it('every new effect has numeric defaults inside their declared range', () => {
    for (const kind of NEW_KINDS) {
      for (const p of EFFECTS[kind].params.filter((q) => typeof q.fallback === 'number')) {
        expect(Number(p.fallback)).toBeGreaterThanOrEqual(p.min);
        expect(Number(p.fallback)).toBeLessThanOrEqual(p.max);
      }
    }
  });
});
