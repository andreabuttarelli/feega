import { describe, expect, it } from 'vitest';
import { extendSchema, outpaintPlan } from './outpaint';

const SIZE = { width: 100, height: 50 };

describe('outpaintPlan', () => {
  it('grows the canvas by the asked fraction of the picture on each side', () => {
    const plan = outpaintPlan(SIZE, { left: 0.1, top: 0, right: 0.3, bottom: 0.2 });

    expect(plan.padded).toEqual({ width: 140, height: 60 });
    expect(plan.offset).toEqual({ left: 10, top: 0 });
  });

  it('masks everything except the original picture, as fractions of the padded canvas', () => {
    const plan = outpaintPlan(SIZE, { left: 0, top: 0, right: 1, bottom: 0 });

    expect(plan.regions).toEqual([{ left: 0.5, top: 0, width: 0.5, height: 1 }]);
  });

  it('masks one strip per extended side only', () => {
    const plan = outpaintPlan(SIZE, { left: 0.5, top: 0.5, right: 0, bottom: 0 });

    expect(plan.regions).toHaveLength(2);
  });
});

describe('extendSchema', () => {
  it('needs at least one side and caps each at 1 (double the picture)', () => {
    expect(extendSchema.safeParse({ right: 0.5 }).success).toBe(true);
    expect(extendSchema.safeParse({}).success).toBe(false);
    expect(extendSchema.safeParse({ right: 1.5 }).success).toBe(false);
    expect(extendSchema.safeParse({ left: -0.1 }).success).toBe(false);
  });
});
