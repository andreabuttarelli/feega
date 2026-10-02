import { describe, expect, it } from 'vitest';
import { addBusinessDays } from './business-days';

describe('addBusinessDays', () => {
  it('skips weekends', () => {
    const friday = new Date('2026-10-02T12:00:00Z');
    expect(addBusinessDays(friday, 1).toISOString()).toBe('2026-10-05T12:00:00.000Z');
  });

  it('ten business days from a Friday is two weeks later', () => {
    const friday = new Date('2026-10-02T12:00:00Z');
    expect(addBusinessDays(friday, 10).toISOString()).toBe('2026-10-16T12:00:00.000Z');
  });

  it('from a Saturday, the first business day is Monday', () => {
    const saturday = new Date('2026-10-03T12:00:00Z');
    expect(addBusinessDays(saturday, 1).toISOString()).toBe('2026-10-05T12:00:00.000Z');
  });
});
