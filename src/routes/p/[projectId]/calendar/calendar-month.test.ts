import { describe, expect, it } from 'vitest';
import { monthOf } from './calendar-month';

describe('monthOf', () => {
  it('legge YYYY-MM dal param', () => {
    expect(monthOf('2026-02')).toEqual({ year: 2026, month: 2 });
  });

  it('senza param torna il mese di oggi', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(monthOf(null, now)).toEqual({ year: 2026, month: 9 });
  });

  it('un param malformato torna il mese di oggi', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(monthOf('garbage', now)).toEqual({ year: 2026, month: 9 });
  });

  it('un mese fuori range torna il mese di oggi', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(monthOf('2026-13', now)).toEqual({ year: 2026, month: 9 });
  });
});
