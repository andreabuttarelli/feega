import { describe, expect, it } from 'vitest';
import { adjustLook, adjustNodes, isNeutral, toneOf, type Adjust } from './adjust';

type Rgb = [number, number, number];

const look = (adjust: Adjust) => adjustLook(adjust)!;
const through = (adjust: Adjust, [r, g, b]: Rgb): Rgb => {
  const m = look(adjust).matrix;
  const row = (i: number) => m[i * 5] * r + m[i * 5 + 1] * g + m[i * 5 + 2] * b + m[i * 5 + 4];
  return [row(0), row(1), row(2)];
};
const curve = (adjust: Adjust, x: number) => {
  const table = look(adjust).table;
  const at = x * (table.length - 1);
  const k = Math.min(table.length - 2, Math.floor(at));
  return table[k] + (at - k) * (table[k + 1] - table[k]);
};

describe('image adjustments', () => {
  it('no adjustment is no filter', () => {
    expect(isNeutral({})).toBe(true);
    expect(isNeutral({ exposure: 0, tint: 0 })).toBe(true);
    expect(adjustLook({})).toBeNull();
    expect(adjustLook(undefined)).toBeNull();
    expect(isNeutral({ shadows: 0.2 })).toBe(false);
  });

  it('exposure of one stop doubles the light', () => {
    expect(through({ exposure: 1 }, [0.25, 0.1, 0.4])).toEqual([0.5, 0.2, 0.8]);
  });

  it('contrast pushes values away from mid grey', () => {
    const [r, g, b] = through({ contrast: 1 }, [0.75, 0.5, 0.25]);
    expect([r, g, b].map((v) => Math.round(v * 100) / 100)).toEqual([1, 0.5, 0]);
  });

  it('saturation of minus one is grey', () => {
    const [r, g, b] = through({ saturation: -1 }, [0.9, 0.2, 0.4]);
    expect(r).toBeCloseTo(g, 5);
    expect(g).toBeCloseTo(b, 5);
  });

  it('a warm temperature raises red and lowers blue', () => {
    const [r, , b] = through({ temperature: 1 }, [0.5, 0.5, 0.5]);
    expect(r).toBeGreaterThan(0.5);
    expect(b).toBeLessThan(0.5);
  });

  it('a positive tint moves toward magenta, away from green', () => {
    const [r, g, b] = through({ tint: 1 }, [0.5, 0.5, 0.5]);
    expect(g).toBeLessThan(0.5);
    expect(r).toBeGreaterThan(0.5);
    expect(b).toBeGreaterThan(0.5);
  });

  it('shadows lift the dark end and leave black and white where they are', () => {
    expect(curve({ shadows: 1 }, 0.2)).toBeGreaterThan(0.2);
    expect(curve({ shadows: 1 }, 0)).toBe(0);
    expect(curve({ shadows: 1 }, 1)).toBe(1);
  });

  it('highlights pull the bright end down', () => {
    expect(curve({ highlights: -1 }, 0.8)).toBeLessThan(0.8);
    expect(curve({ highlights: -1 }, 0)).toBe(0);
    expect(curve({ highlights: -1 }, 1)).toBe(1);
  });

  it('the tone curve never reverses at the extremes', () => {
    const extremes: Adjust[] = [{ shadows: 1, highlights: 1 }, { shadows: -1, highlights: -1 }, { shadows: 1, highlights: -1 }, { shadows: -1, highlights: 1 }];
    for (const adjust of extremes) {
      const table = look(adjust).table;
      table.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(table[i]));
    }
  });

  it('a filter node carries the matrix and the curve in sRGB', () => {
    const node = adjustNodes({ exposure: 0.5, shadows: 0.3 }, 'a');
    expect(node.tag).toBe('filter');
    expect(node.attrs['color-interpolation-filters']).toBe('sRGB');
    expect(node.children?.map((c) => c.tag)).toEqual(['feColorMatrix', 'feComponentTransfer']);
    expect(node.children?.[1].children?.map((c) => c.tag)).toEqual(['feFuncR', 'feFuncG', 'feFuncB']);
  });

  it('the html tone names its filter by what it does, so equal looks share one', () => {
    expect(toneOf({ exposure: 0.5 })?.id).toBe(toneOf({ exposure: 0.5 })?.id);
    expect(toneOf({ exposure: 0.5 })?.id).not.toBe(toneOf({ exposure: 0.6 })?.id);
    expect(toneOf({})).toBeUndefined();
  });
});
