import { describe, expect, it } from 'vitest';
import { PLAN, annualLine, annualPerMonth, monthlyLine } from './plan';

describe('the Cloud price', () => {
  it('is €15 per editor a month', () => {
    expect(monthlyLine(PLAN)).toBe('€15 / editor / month');
  });

  it('is €12 a month billed as €144 a year', () => {
    expect(annualPerMonth(PLAN)).toBe(12);
    expect(annualLine(PLAN)).toBe('€12 / editor / month billed annually (€144 a year)');
  });
});
