import { describe, expect, it } from 'vitest';
import { contourLength, flatten, rectOutline, type Outline } from './geometry';
import { IDENTITY, MODIFIERS, ModifierKind, applyModifiers, type Layer } from './modifiers';

const size = { w: 100, h: 100 };
const square = (): Layer[] => [{ outline: rectOutline(0, size), opacity: 1, matrix: IDENTITY }];
const at = (time = 0) => ({ size, time });
const values = (kind: ModifierKind, patch: Record<string, number> = {}) => ({ ...Object.fromEntries(MODIFIERS[kind].params.map((p) => [p.key, p.fallback])), ...patch });
const run = (kind: ModifierKind, patch: Record<string, number> = {}, layers = square(), time = 0) => applyModifiers(layers, [{ kind, values: values(kind, patch) }], at(time));
const length = (o: Outline) => o.reduce((n, c) => n + contourLength(c), 0);
const area = (o: Outline) =>
  o.reduce((sum, c) => {
    const p = flatten(c);
    return sum + Math.abs(p.reduce((s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1], 0) / 2);
  }, 0);

describe('every modifier kind is declared in one table', () => {
  it('each has a label and params with a fallback inside its range', () => {
    for (const kind of Object.values(ModifierKind)) {
      const spec = MODIFIERS[kind];
      expect(spec.label.length).toBeGreaterThan(0);
      for (const p of spec.params) {
        expect(p.fallback).toBeGreaterThanOrEqual(p.min);
        expect(p.fallback).toBeLessThanOrEqual(p.max);
      }
    }
  });
});

describe('modifiers', () => {
  it('trim draws a share of the outline, the draw-on', () => {
    const [layer] = run(ModifierKind.Trim, { start: 0, end: 0.25, offset: 0 });
    expect(length(layer.outline)).toBeCloseTo(100, 5);
  });

  it('repeater makes copies with a stepping transform and an opacity ramp', () => {
    const layers = run(ModifierKind.Repeater, { copies: 3, offsetX: 0.5, endOpacity: 0 });
    expect(layers).toHaveLength(3);
    expect(layers.map((l) => l.opacity)).toEqual([1, 0.5, 0]);
    expect(layers[2].matrix[4]).toBeCloseTo(100, 6);
  });

  it('a radial repeater turns copies around the box centre', () => {
    const layers = run(ModifierKind.Repeater, { copies: 4, rotation: 90, offsetX: 0 });
    const m = layers[1].matrix;
    expect([m[0], m[1], m[2], m[3]].map((n) => Math.round(n))).toEqual([0, 1, -1, 0]);
    expect(m[4]).toBeCloseTo(100, 6);
    expect(m[5]).toBeCloseTo(0, 6);
  });

  it('offset grows a closed outline outwards and a negative amount shrinks it', () => {
    expect(area(run(ModifierKind.Offset, { amount: 0.1 })[0].outline)).toBeCloseTo(120 * 120, 3);
    expect(area(run(ModifierKind.Offset, { amount: -0.1 })[0].outline)).toBeCloseTo(80 * 80, 3);
  });

  it('wiggle is seeded: same seed and time give the same outline, another seed does not', () => {
    const a = run(ModifierKind.Wiggle, { seed: 3 }, square(), 0.4);
    const b = run(ModifierKind.Wiggle, { seed: 3 }, square(), 0.4);
    const c = run(ModifierKind.Wiggle, { seed: 4 }, square(), 0.4);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('wiggle moves with time when it has a speed', () => {
    expect(run(ModifierKind.Wiggle, { speed: 2 }, square(), 0)).not.toEqual(run(ModifierKind.Wiggle, { speed: 2 }, square(), 0.3));
    expect(run(ModifierKind.Wiggle, { speed: 0 }, square(), 0)).toEqual(run(ModifierKind.Wiggle, { speed: 0 }, square(), 0.3));
  });

  it('zigzag alternates its ridges in and out', () => {
    const [layer] = run(ModifierKind.ZigZag, { ridges: 8, size: 0.1 });
    expect(layer.outline[0].vertices).toHaveLength(16);
  });

  it('round corners turns sharp corners into curves', () => {
    const [layer] = run(ModifierKind.RoundCorners, { radius: 0.1 });
    expect(layer.outline[0].vertices).toHaveLength(8);
    expect(length(layer.outline)).toBeLessThan(400);
  });

  it('merge subtracts, unites and intersects the contours of a layer', () => {
    const two: Layer[] = [{ outline: [...rectOutline(0, size), ...rectOutline(0, { w: 50, h: 50 })], opacity: 1, matrix: IDENTITY }];
    expect(area(run(ModifierKind.Merge, { op: 1 }, two)[0].outline)).toBeCloseTo(7500, 3);
    expect(area(run(ModifierKind.Merge, { op: 0 }, two)[0].outline)).toBeCloseTo(10000, 3);
    expect(area(run(ModifierKind.Merge, { op: 2 }, two)[0].outline)).toBeCloseTo(2500, 3);
  });

  it('stacks in order: repeat then trim trims every copy', () => {
    const layers = applyModifiers(square(), [
      { kind: ModifierKind.Repeater, values: values(ModifierKind.Repeater, { copies: 2 }) },
      { kind: ModifierKind.Trim, values: values(ModifierKind.Trim, { end: 0.5 }) }
    ], at());
    expect(layers.map((l) => Math.round(length(l.outline)))).toEqual([200, 200]);
  });
});
