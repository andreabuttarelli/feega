import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../components';
import { ellipseOutline, flatten, type Outline } from './geometry';
import { IDENTITY, MODIFIERS, ModifierKind, applyModifiers, movesOverTime, type Layer } from './modifiers';
import { shapeMarkup, type Paint, type ShapeLook } from './render';

const size = { w: 200, h: 200 };
const circle = (): Layer[] => [{ outline: ellipseOutline(size), opacity: 1, matrix: IDENTITY }];
const values = (kind: ModifierKind, patch: Record<string, number> = {}) => ({ ...Object.fromEntries(MODIFIERS[kind].params.map((p) => [p.key, p.fallback])), ...patch });
const run = (kind: ModifierKind, patch: Record<string, number>, time: number) => applyModifiers(circle(), [{ kind, values: values(kind, patch) }], { size, time });
const radii = (o: Outline) => o.flatMap((c) => flatten(c)).map(([x, y]) => Math.hypot(x - 100, y - 100));
const look = (patch: Record<string, unknown> = {}) => COMPONENTS.Shape.schema.parse({ shape: 'circle', ...patch }) as unknown as ShapeLook;
const paint: Paint = { id: 'a', size, unit: 1000, time: 0, color: (v) => v };

describe('wave modifier', () => {
  it('ripples the edge by its amplitude around the original outline', () => {
    const r = radii(run(ModifierKind.Wave, { amplitude: 0.05, waves: 6, speed: 1 }, 0.25)[0].outline);

    expect(Math.min(...r)).toBeGreaterThan(100 - 10 - 0.5);
    expect(Math.max(...r)).toBeLessThan(100 + 10 + 0.5);
    expect(Math.max(...r) - Math.min(...r)).toBeGreaterThan(15);
  });

  it('travels with time and comes back after one period', () => {
    const at = (t: number) => run(ModifierKind.Wave, { amplitude: 0.01, waves: 6, speed: 2 }, t)[0].outline;

    expect(at(0.1)).not.toEqual(at(0.3));
    expect(radii(at(0.1)).map((n) => n.toFixed(6))).toEqual(radii(at(0.6)).map((n) => n.toFixed(6)));
  });

  it('moves over time only with a speed and an amplitude', () => {
    expect(movesOverTime({ kind: ModifierKind.Wave, values: values(ModifierKind.Wave, { speed: 1 }) })).toBe(true);
    expect(movesOverTime({ kind: ModifierKind.Wave, values: values(ModifierKind.Wave, { speed: 0 }) })).toBe(false);
  });
});

describe('blob modifier', () => {
  it('bends the outline into smooth curves that stay near the original', () => {
    const [layer] = run(ModifierKind.Blob, { amount: 0.05, lobes: 6, speed: 0.5, seed: 3 }, 1.2);
    const curved = layer.outline[0].vertices.every((v) => v.in !== v.p && (v.in[0] !== v.p[0] || v.in[1] !== v.p[1]));
    const r = radii(layer.outline);

    expect(curved).toBe(true);
    expect(Math.min(...r)).toBeGreaterThan(100 * 0.85);
    expect(Math.max(...r)).toBeLessThan(100 * 1.15);
  });

  it('is a pure function of time and seed: same inputs, same outline; nearby times, nearby outlines', () => {
    const at = (t: number, seed = 3) => run(ModifierKind.Blob, { amount: 0.05, lobes: 6, speed: 0.5, seed }, t)[0].outline;
    const shift = (a: Outline, b: Outline) => Math.max(...radii(a).map((r, i) => Math.abs(r - radii(b)[i])));

    expect(at(1.2)).toEqual(at(1.2));
    expect(at(1.2, 4)).not.toEqual(at(1.2, 3));
    expect(shift(at(1.2), at(1.2 + 1 / 30))).toBeLessThan(3);
    expect(shift(at(1.2), at(2.4))).toBeGreaterThan(1);
  });
});

describe('gooey modifier', () => {
  it('leaves the geometry alone', () => {
    expect(run(ModifierKind.Goo, {}, 0)).toEqual(circle());
  });

  it('wraps the drawing in a blur and alpha-threshold filter scaled to the frame', () => {
    const svg = shapeMarkup(look({ modifiers: [{ id: 'g', kind: ModifierKind.Goo, params: { blur: 0.02, threshold: 0.5 } }] }), paint);

    expect(svg).toContain('<filter id="sf-a"');
    expect(svg).toContain('<feGaussianBlur in="SourceGraphic" stdDeviation="20"');
    expect(svg).toMatch(/<feColorMatrix [^>]*values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 \d+ -\d+(\.\d+)?"/);
    expect(svg).toContain('filter="url(#sf-a)"');
  });

  it('filters only the drawing and its melt this frame, not seven times the box around it', () => {
    const svg = shapeMarkup(look({ modifiers: [{ id: 'g', kind: ModifierKind.Goo, params: { blur: 0.02, threshold: 0.5 } }] }), paint);
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number(new RegExp(`<filter id="sf-a"[^>]* ${k}="(-?[\\d.]+)"`).exec(svg)![1]));

    expect(x).toBeLessThanOrEqual(-60);
    expect(x).toBeGreaterThan(-paint.size.w);
    expect(x + w).toBeGreaterThanOrEqual(paint.size.w + 60);
    expect(w * h).toBeLessThan(4 * paint.size.w * paint.size.h);
    expect(y).toBeLessThanOrEqual(-60);
  });

  it('a shape without it has no filter, and a disabled one draws the same as none', () => {
    expect(shapeMarkup(look(), paint)).not.toContain('<filter');
    expect(shapeMarkup(look({ modifiers: [{ id: 'g', kind: ModifierKind.Goo, enabled: false, params: {} }] }), paint)).toBe(shapeMarkup(look(), paint));
  });
});
