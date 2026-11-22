import { describe, expect, it } from 'vitest';
import { PLAN, annualLine, priceLabel } from './plan';

describe('the Cloud price', () => {
  it('is 15 euros per editor a month', () => {
    expect(priceLabel(PLAN)).toBe('€15');
    expect(PLAN.per).toBe('editor');
  });

  it('bills 12 euros a month, 144 a year, on the annual plan', () => {
    expect(annualLine(PLAN)).toBe('or €12 a month billed annually, €144 a year. Viewers are free.');
  });
});
